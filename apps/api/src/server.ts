import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { RateLimiterMemory } from "rate-limiter-flexible";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient, Role, VerificationStatus, Visibility, ItemCategory, GroupJoinStatus } from "@prisma/client";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  ALLOWED_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsedEnv.data;
const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

const PORT = env.PORT;
const JWT_SECRET = env.JWT_SECRET;
const CLIENT_URL = env.CLIENT_URL;
const ALLOWED_ORIGINS = new Set([
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean) : [])
]);
const limiter = new RateLimiterMemory({ points: 180, duration: 60 });

app.set("trust proxy", 1);

app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip ?? "unknown");
    next();
  } catch {
    res.status(429).json({ error: "Too many requests. Please slow down." });
  }
});

app.use(cors({
  origin(origin, callback) {
    const isAllowedPreview = typeof origin === "string" && origin.endsWith(".vercel.app");
    if (!origin || ALLOWED_ORIGINS.has(origin) || isAllowedPreview) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

type AuthUser = {
  id: string;
  role: Role;
  verificationStatus: VerificationStatus;
  collegeId?: string | null;
  batchId?: string | null;
};

type AuthedRequest = express.Request & { user?: AuthUser };

function signToken(payload: AuthUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function verifiedOnly(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  if (req.user.verificationStatus !== VerificationStatus.VERIFIED && req.user.role !== Role.ADMIN) {
    return res.status(403).json({ error: "Verification pending. Read-only access only." });
  }

  return next();
}

function roleAllowed(roles: Role[]) {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Role not allowed" });
    }

    return next();
  };
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  collegeName: z.string().min(2),
  departmentName: z.string().min(2),
  batchStartYear: z.coerce.number().int().min(2020),
  batchEndYear: z.coerce.number().int().max(2040)
}).refine((d) => d.batchEndYear >= d.batchStartYear, {
  message: "Batch end year must be after or equal to start year",
  path: ["batchEndYear"]
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function listQuery(req: express.Request) {
  const take = Math.min(Number(req.query.take ?? 50), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  return { take, skip: (page - 1) * take };
}

async function bumpEngagement(userId: string, points = 5) {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActiveAt: true }
  });
  if (!user) return;

  let nextStreak = user.streakDays;
  if (!user.lastActiveAt) {
    nextStreak = 1;
  } else {
    const last = new Date(user.lastActiveAt);
    const lastDay = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
    const nowDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayDiff = Math.floor((nowDay.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff === 1) nextStreak = user.streakDays + 1;
    if (dayDiff > 1) nextStreak = 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      reputationScore: { increment: points },
      streakDays: nextStreak,
      lastActiveAt: now
    }
  });
}

async function createUserNotification(userId: string, title: string, body: string) {
  await prisma.notification.create({
    data: { userId, title, body }
  });
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "quad-api" });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({
      error: first ? `${String(first.path[0] ?? "form")}: ${first.message}` : "Invalid signup data",
      details: parsed.error.flatten()
    });
  }

  const data = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const college = await prisma.college.upsert({
    where: { name: data.collegeName },
    update: {},
    create: { name: data.collegeName }
  });

  const department = await prisma.department.upsert({
    where: {
      name_collegeId: {
        name: data.departmentName,
        collegeId: college.id
      }
    },
    update: {},
    create: {
      name: data.departmentName,
      collegeId: college.id
    }
  });

  const batchName = `${data.departmentName} ${data.batchStartYear}-${data.batchEndYear}`;
  const batch = await prisma.batch.upsert({
    where: {
      name_departmentId_collegeId: {
        name: batchName,
        departmentId: department.id,
        collegeId: college.id
      }
    },
    update: {},
    create: {
      name: batchName,
      startYear: data.batchStartYear,
      endYear: data.batchEndYear,
      collegeId: college.id,
      departmentId: department.id
    }
  });

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: Role.STUDENT,
      verificationStatus: VerificationStatus.PENDING,
      collegeId: college.id,
      departmentId: department.id,
      batchId: batch.id
    }
  });

  const token = signToken({
    id: user.id,
    role: user.role,
    verificationStatus: user.verificationStatus,
    collegeId: user.collegeId,
    batchId: user.batchId
  });

  return res.status(201).json({ token, user });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({
      error: first ? `${String(first.path[0] ?? "form")}: ${first.message}` : "Invalid login",
      details: parsed.error.flatten()
    });
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({
    id: user.id,
    role: user.role,
    verificationStatus: user.verificationStatus,
    collegeId: user.collegeId,
    batchId: user.batchId
  });

  return res.json({ token, user });
});

app.get("/api/me", authRequired, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      college: true,
      department: true,
      batch: true
    }
  });

  return res.json(user);
});

app.get("/api/engagement/me", authRequired, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      reputationScore: true,
      streakDays: true,
      lastActiveAt: true
    }
  });
  return res.json(user ?? { reputationScore: 120, streakDays: 1, lastActiveAt: null });
});

app.post("/api/engagement/pulse", authRequired, async (req: AuthedRequest, res) => {
  await bumpEngagement(req.user!.id, 0);
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { reputationScore: true, streakDays: true, lastActiveAt: true }
  });
  return res.json({ ok: true, engagement: user });
});

app.get("/api/notifications", authRequired, async (req: AuthedRequest, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  return res.json(rows);
});

app.post("/api/notifications", authRequired, async (req: AuthedRequest, res) => {
  const body = z.object({
    title: z.string().min(2).max(100),
    body: z.string().min(2).max(240)
  }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }
  const created = await prisma.notification.create({
    data: {
      userId: req.user!.id,
      title: body.data.title,
      body: body.data.body
    }
  });
  return res.status(201).json(created);
});

app.patch("/api/notifications/:id/read", authRequired, async (req: AuthedRequest, res) => {
  const row = await prisma.notification.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, userId: true }
  });
  if (!row || row.userId !== req.user!.id) {
    return res.status(404).json({ error: "Notification not found" });
  }
  const updated = await prisma.notification.update({
    where: { id: row.id },
    data: { read: true, readById: req.user!.id, readAt: new Date() }
  });
  return res.json(updated);
});

app.get("/api/users/pending", authRequired, roleAllowed([Role.ADMIN]), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { verificationStatus: VerificationStatus.PENDING },
    include: {
      college: true,
      department: true,
      batch: true
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(users);
});

app.get("/api/users/verified", authRequired, roleAllowed([Role.ADMIN]), async (req: AuthedRequest, res) => {
  const users = await prisma.user.findMany({
    where: {
      verificationStatus: VerificationStatus.VERIFIED,
      collegeId: req.user?.collegeId ?? undefined
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { name: true } }
    },
    orderBy: { name: "asc" }
  });

  return res.json(users);
});

app.post("/api/verification/approve/:userId", authRequired, roleAllowed([Role.ADMIN]), async (req, res) => {
  const updated = await prisma.user.update({
    where: { id: String(req.params.userId) },
    data: { verificationStatus: VerificationStatus.VERIFIED }
  });

  return res.json(updated);
});

app.get("/api/posts", authRequired, async (req: AuthedRequest, res) => {
  const { take, skip } = listQuery(req);
  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { visibility: Visibility.PUBLIC },
        { visibility: Visibility.COLLEGE, collegeId: req.user?.collegeId ?? undefined },
        { visibility: Visibility.BATCH, author: { batchId: req.user?.batchId ?? undefined } }
      ]
    },
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take,
    skip
  });

  res.json(posts);
});

app.post("/api/posts", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({
    content: z.string().min(2),
    visibility: z.nativeEnum(Visibility).default(Visibility.COLLEGE)
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.post.create({
    data: {
      content: body.data.content,
      visibility: body.data.visibility,
      authorId: req.user!.id,
      collegeId: req.user!.collegeId ?? null
    },
    include: { author: true }
  });

  await bumpEngagement(req.user!.id, 6);
  await createUserNotification(req.user!.id, "Post published", "Your campus wall update is now live.");

  res.status(201).json(created);
});

app.get("/api/batch/messages", authRequired, async (req: AuthedRequest, res) => {
  if (!req.user?.batchId) {
    return res.status(400).json({ error: "No batch assigned" });
  }

  const messages = await prisma.batchMessage.findMany({
    where: { batchId: req.user.batchId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  res.json(messages);
});

app.post("/api/batch/messages", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  if (!req.user?.batchId) {
    return res.status(400).json({ error: "No batch assigned" });
  }

  const body = z.object({ message: z.string().min(1).max(500) }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.batchMessage.create({
    data: {
      message: body.data.message,
      authorId: req.user.id,
      batchId: req.user.batchId
    },
    include: { author: true }
  });

  io.to(`batch:${req.user.batchId}`).emit("batch:message", created);
  await bumpEngagement(req.user!.id, 3);

  res.status(201).json(created);
});

app.get("/api/marketplace", authRequired, async (req, res) => {
  const { take, skip } = listQuery(req);
  const items = await prisma.marketplaceItem.findMany({
    where: { isActive: true },
    include: { seller: true },
    orderBy: { createdAt: "desc" },
    take,
    skip
  });

  res.json(items);
});

app.post("/api/marketplace", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({
    title: z.string().min(2),
    description: z.string().min(3),
    price: z.number().nonnegative(),
    category: z.nativeEnum(ItemCategory).default(ItemCategory.OTHER),
    location: z.string().optional()
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const item = await prisma.marketplaceItem.create({
    data: {
      ...body.data,
      sellerId: req.user!.id
    },
    include: { seller: true }
  });

  await bumpEngagement(req.user!.id, 7);
  await createUserNotification(req.user!.id, "Marketplace listing live", "Your campus bazaar listing is now discoverable.");

  res.status(201).json(item);
});

app.get("/api/opportunities", authRequired, async (req, res) => {
  const { take, skip } = listQuery(req);
  const data = await prisma.opportunity.findMany({
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
    take,
    skip
  });
  res.json(data);
});

app.post("/api/opportunities", authRequired, roleAllowed([Role.ADMIN, Role.RECRUITER]), async (req: AuthedRequest, res) => {
  const body = z.object({
    title: z.string().min(2),
    company: z.string().min(2),
    description: z.string().min(5),
    location: z.string().optional(),
    branch: z.string().optional(),
    year: z.number().int().optional()
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.opportunity.create({
    data: {
      ...body.data,
      createdById: req.user!.id
    },
    include: { createdBy: true }
  });

  res.status(201).json(created);
});

app.get("/api/deals", authRequired, async (_req, res) => {
  const deals = await prisma.deal.findMany({
    include: { createdBy: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(deals);
});

app.post("/api/deals", authRequired, roleAllowed([Role.ADMIN, Role.BRAND]), async (req: AuthedRequest, res) => {
  const body = z.object({
    brand: z.string().min(2),
    title: z.string().min(2),
    code: z.string().min(2),
    description: z.string().min(2),
    expiresAt: z.string().datetime().optional()
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.deal.create({
    data: {
      brand: body.data.brand,
      title: body.data.title,
      code: body.data.code,
      description: body.data.description,
      expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : undefined,
      createdById: req.user!.id
    },
    include: { createdBy: true }
  });

  res.status(201).json(created);
});

app.get("/api/resources", authRequired, async (req: AuthedRequest, res) => {
  const rows = await prisma.resource.findMany({
    where: {
      OR: [
        { collegeId: null },
        { collegeId: req.user?.collegeId ?? undefined }
      ]
    },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" }
  });

  res.json(rows);
});

app.post("/api/resources", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({
    title: z.string().min(2),
    url: z.string().url(),
    subject: z.string().min(2)
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.resource.create({
    data: {
      ...body.data,
      collegeId: req.user!.collegeId ?? null,
      uploadedById: req.user!.id
    },
    include: { uploadedBy: true }
  });

  await bumpEngagement(req.user!.id, 6);
  await createUserNotification(req.user!.id, "Resource uploaded", "Your learning resource has been published.");

  res.status(201).json(created);
});

app.get("/api/events", authRequired, async (req: AuthedRequest, res) => {
  const rows = await prisma.event.findMany({
    where: {
      OR: [
        { collegeId: null },
        { collegeId: req.user?.collegeId ?? undefined }
      ]
    },
    include: { createdBy: true },
    orderBy: { eventDate: "asc" }
  });

  res.json(rows);
});

app.post("/api/events", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({
    title: z.string().min(2),
    description: z.string().min(5),
    venue: z.string().optional(),
    eventDate: z.string().datetime()
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.event.create({
    data: {
      title: body.data.title,
      description: body.data.description,
      venue: body.data.venue,
      eventDate: new Date(body.data.eventDate),
      collegeId: req.user!.collegeId ?? null,
      createdById: req.user!.id
    },
    include: { createdBy: true }
  });

  await bumpEngagement(req.user!.id, 8);
  await createUserNotification(req.user!.id, "Event published", "Your campus event is now visible to students.");

  res.status(201).json(created);
});

app.get("/api/study-rooms", authRequired, async (_req, res) => {
  const rows = await prisma.studyRoom.findMany({
    include: {
      createdBy: true,
      members: {
        include: { user: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(rows);
});

app.post("/api/study-rooms", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({
    name: z.string().min(2),
    topic: z.string().min(2)
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const room = await prisma.studyRoom.create({
    data: {
      name: body.data.name,
      topic: body.data.topic,
      createdById: req.user!.id,
      members: {
        create: {
          userId: req.user!.id
        }
      }
    },
    include: {
      createdBy: true,
      members: {
        include: { user: true }
      }
    }
  });

  await bumpEngagement(req.user!.id, 7);
  await createUserNotification(req.user!.id, "Study room created", `Room '${room.name}' is open for members.`);

  res.status(201).json(room);
});

app.post("/api/study-rooms/:id/join", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const room = await prisma.studyRoomMember.upsert({
    where: {
      studyRoomId_userId: {
        studyRoomId: String(req.params.id),
        userId: req.user!.id
      }
    },
    update: {},
    create: {
      studyRoomId: String(req.params.id),
      userId: req.user!.id
    }
  });

  res.json(room);
});

app.get("/api/mentorship/sessions", authRequired, async (req: AuthedRequest, res) => {
  const rows = await prisma.mentorSession.findMany({
    where: {
      OR: [
        { requesterId: req.user!.id },
        { collegeId: req.user?.collegeId ?? undefined }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json(rows);
});

app.post("/api/mentorship/sessions", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({
    topic: z.string().min(3),
    mentor: z.string().min(2),
    mode: z.enum(["Online", "Offline"]),
    slot: z.string().datetime(),
    note: z.string().min(4).max(500)
  }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const created = await prisma.mentorSession.create({
    data: {
      topic: body.data.topic,
      mentor: body.data.mentor,
      mode: body.data.mode,
      slot: new Date(body.data.slot),
      note: body.data.note,
      requesterId: req.user!.id,
      collegeId: req.user?.collegeId ?? null
    }
  });

  await bumpEngagement(req.user!.id, 10);
  await createUserNotification(req.user!.id, "Mentorship request created", `Session '${created.topic}' has been scheduled.`);

  res.status(201).json(created);
});

app.get("/api/groups", authRequired, async (req: AuthedRequest, res) => {
  const groups = await prisma.campusGroup.findMany({
    where: {
      OR: [
        { collegeId: req.user?.collegeId ?? undefined },
        { ownerId: req.user?.id ?? undefined },
        { pocId: req.user?.id ?? undefined },
        { members: { some: { userId: req.user?.id ?? undefined } } }
      ]
    },
    include: {
      department: true,
      owner: { select: { id: true, name: true, email: true } },
      poc: { select: { id: true, name: true, email: true } },
      members: { select: { userId: true } },
      requests: {
        where: { requesterId: req.user?.id ?? "" },
        select: { status: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const payload = groups.map((group) => {
    const myRequest = group.requests[0]?.status ?? null;
    const isMember = group.members.some((member) => member.userId === req.user?.id);
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      departmentName: group.department?.name ?? null,
      owner: group.owner,
      poc: group.poc,
      memberCount: group.members.length,
      isMember,
      myRequestStatus: myRequest
    };
  });

  res.json(payload);
});

app.post("/api/groups", authRequired, roleAllowed([Role.ADMIN]), async (req: AuthedRequest, res) => {
  const body = z.object({
    name: z.string().min(2),
    description: z.string().min(4),
    pocUserId: z.string().cuid(),
    departmentName: z.string().min(2).optional()
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const pocUser = await prisma.user.findUnique({ where: { id: body.data.pocUserId } });
  if (!pocUser) {
    return res.status(404).json({ error: "POC user not found" });
  }

  if (!req.user?.collegeId || pocUser.collegeId !== req.user.collegeId) {
    return res.status(400).json({ error: "POC must belong to your college" });
  }

  let departmentId: string | undefined;
  if (body.data.departmentName) {
    const department = await prisma.department.upsert({
      where: {
        name_collegeId: {
          name: body.data.departmentName,
          collegeId: req.user.collegeId
        }
      },
      update: {},
      create: {
        name: body.data.departmentName,
        collegeId: req.user.collegeId
      }
    });
    departmentId = department.id;
  }

  const group = await prisma.campusGroup.create({
    data: {
      name: body.data.name,
      description: body.data.description,
      collegeId: req.user.collegeId,
      departmentId,
      ownerId: req.user.id,
      pocId: body.data.pocUserId
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      poc: { select: { id: true, name: true, email: true } },
      department: true,
      members: { select: { userId: true } }
    }
  });

  await prisma.campusGroupMember.upsert({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: req.user.id
      }
    },
    update: {},
    create: {
      groupId: group.id,
      userId: req.user.id
    }
  });

  await prisma.campusGroupMember.upsert({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: body.data.pocUserId
      }
    },
    update: {},
    create: {
      groupId: group.id,
      userId: body.data.pocUserId
    }
  });

  res.status(201).json(group);
});

app.get("/api/owner/overview", authRequired, roleAllowed([Role.ADMIN]), async (req: AuthedRequest, res) => {
  const collegeId = req.user?.collegeId;
  if (!collegeId) {
    return res.status(400).json({ error: "Admin college is not assigned" });
  }

  const [groups, membersCount, pendingCount] = await Promise.all([
    prisma.campusGroup.findMany({
      where: { collegeId },
      include: {
        department: true,
        members: { select: { id: true } },
        requests: { where: { status: GroupJoinStatus.PENDING }, select: { id: true } },
        owner: { select: { id: true, name: true, email: true } },
        poc: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.campusGroupMember.count({
      where: {
        group: { collegeId }
      }
    }),
    prisma.campusGroupJoinRequest.count({
      where: {
        status: GroupJoinStatus.PENDING,
        group: { collegeId }
      }
    })
  ]);

  const departmentMap = new Map<string, { groupCount: number; memberCount: number; pendingRequests: number }>();

  for (const group of groups) {
    const key = group.department?.name ?? "Campus-wide";
    const current = departmentMap.get(key) ?? { groupCount: 0, memberCount: 0, pendingRequests: 0 };
    current.groupCount += 1;
    current.memberCount += group.members.length;
    current.pendingRequests += group.requests.length;
    departmentMap.set(key, current);
  }

  const departmentStats = Array.from(departmentMap.entries())
    .map(([departmentName, value]) => ({ departmentName, ...value }))
    .sort((a, b) => b.memberCount - a.memberCount);

  const groupsPayload = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    departmentName: group.department?.name ?? null,
    owner: group.owner,
    poc: group.poc,
    memberCount: group.members.length,
    pendingRequests: group.requests.length,
    createdAt: group.createdAt
  }));

  res.json({
    metrics: {
      groupCount: groups.length,
      membersCount,
      pendingCount
    },
    departmentStats,
    groups: groupsPayload
  });
});

app.patch("/api/owner/groups/:id/poc", authRequired, roleAllowed([Role.ADMIN]), async (req: AuthedRequest, res) => {
  const body = z.object({
    pocUserId: z.string().cuid().nullable().optional()
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const groupId = String(req.params.id);
  const group = await prisma.campusGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  if (group.collegeId !== req.user?.collegeId) {
    return res.status(403).json({ error: "Group does not belong to your college" });
  }

  let nextPocId: string | null = null;
  if (body.data.pocUserId) {
    const candidate = await prisma.user.findUnique({ where: { id: body.data.pocUserId } });
    if (!candidate || candidate.collegeId !== req.user?.collegeId) {
      return res.status(400).json({ error: "POC must belong to your college" });
    }
    nextPocId = candidate.id;
  }

  const updated = await prisma.campusGroup.update({
    where: { id: groupId },
    data: {
      pocId: nextPocId
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      poc: { select: { id: true, name: true, email: true } },
      members: { select: { userId: true } },
      requests: { where: { status: GroupJoinStatus.PENDING }, select: { id: true } },
      department: true
    }
  });

  if (nextPocId) {
    await prisma.campusGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: nextPocId
        }
      },
      update: {},
      create: {
        groupId,
        userId: nextPocId
      }
    });
  }

  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    departmentName: updated.department?.name ?? null,
    owner: updated.owner,
    poc: updated.poc,
    memberCount: updated.members.length,
    pendingRequests: updated.requests.length,
    createdAt: updated.createdAt
  });
});

app.patch("/api/owner/groups/:id/transfer", authRequired, roleAllowed([Role.ADMIN]), async (req: AuthedRequest, res) => {
  const body = z.object({ newOwnerId: z.string().cuid() }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const groupId = String(req.params.id);
  const group = await prisma.campusGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  const nextOwner = await prisma.user.findUnique({ where: { id: body.data.newOwnerId } });
  if (!nextOwner || nextOwner.collegeId !== req.user?.collegeId) {
    return res.status(400).json({ error: "New owner must belong to your college" });
  }

  const updated = await prisma.campusGroup.update({
    where: { id: groupId },
    data: { ownerId: nextOwner.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      poc: { select: { id: true, name: true, email: true } },
      members: { select: { userId: true } },
      requests: { where: { status: GroupJoinStatus.PENDING }, select: { id: true } },
      department: true
    }
  });

  await prisma.campusGroupMember.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId: nextOwner.id
      }
    },
    update: {},
    create: {
      groupId,
      userId: nextOwner.id
    }
  });

  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    departmentName: updated.department?.name ?? null,
    owner: updated.owner,
    poc: updated.poc,
    memberCount: updated.members.length,
    pendingRequests: updated.requests.length,
    createdAt: updated.createdAt
  });
});

app.post("/api/owner/groups/requests/bulk-approve", authRequired, roleAllowed([Role.ADMIN]), async (req: AuthedRequest, res) => {
  const body = z.object({
    requestIds: z.array(z.string().cuid()).min(1).max(200)
  }).safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const requests = await prisma.campusGroupJoinRequest.findMany({
    where: {
      id: { in: body.data.requestIds },
      status: GroupJoinStatus.PENDING,
      group: { collegeId: req.user?.collegeId ?? undefined }
    },
    select: {
      id: true,
      groupId: true,
      requesterId: true
    }
  });

  if (requests.length === 0) {
    return res.json({ updated: 0 });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of requests) {
      await tx.campusGroupJoinRequest.update({
        where: { id: row.id },
        data: {
          status: GroupJoinStatus.APPROVED,
          reviewedById: req.user!.id,
          reviewedAt: new Date()
        }
      });

      await tx.campusGroupMember.upsert({
        where: {
          groupId_userId: {
            groupId: row.groupId,
            userId: row.requesterId
          }
        },
        update: {},
        create: {
          groupId: row.groupId,
          userId: row.requesterId
        }
      });
    }
  });

  res.json({ updated: requests.length });
});

app.get("/api/groups/requests/incoming", authRequired, async (req: AuthedRequest, res) => {
  const requests = await prisma.campusGroupJoinRequest.findMany({
    where: {
      status: GroupJoinStatus.PENDING,
      group: {
        OR: [
          { ownerId: req.user?.id ?? undefined },
          { pocId: req.user?.id ?? undefined }
        ]
      }
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(requests);
});

app.post("/api/groups/:id/requests", authRequired, verifiedOnly, async (req: AuthedRequest, res) => {
  const body = z.object({ message: z.string().max(240).optional() }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const groupId = String(req.params.id);
  const group = await prisma.campusGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  if (group.collegeId !== req.user?.collegeId) {
    return res.status(403).json({ error: "You can only request groups in your college" });
  }

  const existingMember = await prisma.campusGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: req.user!.id
      }
    }
  });

  if (existingMember) {
    return res.status(409).json({ error: "You are already a member" });
  }

  const request = await prisma.campusGroupJoinRequest.upsert({
    where: {
      groupId_requesterId: {
        groupId,
        requesterId: req.user!.id
      }
    },
    update: {
      message: body.data.message,
      status: GroupJoinStatus.PENDING,
      reviewedById: null,
      reviewedAt: null
    },
    create: {
      groupId,
      requesterId: req.user!.id,
      message: body.data.message,
      status: GroupJoinStatus.PENDING
    }
  });

  await bumpEngagement(req.user!.id, 5);
  if (group.ownerId) {
    await createUserNotification(group.ownerId, "New group join request", "A student requested to join your group.");
  }
  if (group.pocId && group.pocId !== group.ownerId) {
    await createUserNotification(group.pocId, "New group join request", "A student requested to join your assigned group.");
  }

  res.status(201).json(request);
});

app.post("/api/groups/requests/:requestId/approve", authRequired, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.requestId);
  const row = await prisma.campusGroupJoinRequest.findUnique({
    where: { id: requestId },
    include: { group: true }
  });

  if (!row) {
    return res.status(404).json({ error: "Request not found" });
  }

  if (row.group.ownerId !== req.user?.id && row.group.pocId !== req.user?.id) {
    return res.status(403).json({ error: "Only group owner or POC can approve" });
  }

  await prisma.$transaction([
    prisma.campusGroupJoinRequest.update({
      where: { id: requestId },
      data: {
        status: GroupJoinStatus.APPROVED,
        reviewedById: req.user!.id,
        reviewedAt: new Date()
      }
    }),
    prisma.campusGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: row.groupId,
          userId: row.requesterId
        }
      },
      update: {},
      create: {
        groupId: row.groupId,
        userId: row.requesterId
      }
    })
  ]);

  await bumpEngagement(req.user!.id, 4);
  await createUserNotification(row.requesterId, "Group request approved", `You were approved for ${row.group.name}.`);

  res.json({ ok: true });
});

app.post("/api/groups/requests/:requestId/reject", authRequired, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.requestId);
  const row = await prisma.campusGroupJoinRequest.findUnique({
    where: { id: requestId },
    include: { group: true }
  });

  if (!row) {
    return res.status(404).json({ error: "Request not found" });
  }

  if (row.group.ownerId !== req.user?.id && row.group.pocId !== req.user?.id) {
    return res.status(403).json({ error: "Only group owner or POC can reject" });
  }

  await prisma.campusGroupJoinRequest.update({
    where: { id: requestId },
    data: {
      status: GroupJoinStatus.REJECTED,
      reviewedById: req.user!.id,
      reviewedAt: new Date()
    }
  });

  await bumpEngagement(req.user!.id, 2);
  await createUserNotification(row.requesterId, "Group request rejected", `Your join request for ${row.group.name} was rejected.`);

  res.json({ ok: true });
});

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      const isAllowedPreview = typeof origin === "string" && origin.endsWith(".vercel.app");
      if (!origin || ALLOWED_ORIGINS.has(origin) || isAllowedPreview) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Missing token"));
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as AuthUser;
    (socket.data as { user?: AuthUser }).user = user;
    return next();
  } catch {
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const user = (socket.data as { user?: AuthUser }).user;
  if (!user) {
    socket.disconnect(true);
    return;
  }

  if (user.batchId) {
    socket.join(`batch:${user.batchId}`);
  }

  socket.on("batch:message", async (payload: { message: string }) => {
    if (!user.batchId || user.verificationStatus !== VerificationStatus.VERIFIED) {
      return;
    }

    const created = await prisma.batchMessage.create({
      data: {
        message: payload.message,
        batchId: user.batchId,
        authorId: user.id
      },
      include: { author: true }
    });

    io.to(`batch:${user.batchId}`).emit("batch:message", created);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`QUAD API running on port ${PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Shutting down gracefully...`);
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
