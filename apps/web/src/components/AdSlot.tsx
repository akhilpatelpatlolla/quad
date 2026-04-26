type AdSlotProps = {
  id: string;
  format?: "banner" | "inline" | "sidebar";
  title?: string;
  description?: string;
  cta?: string;
  /** Enterprise narrative: we monetize with partners, not by charging students. */
  mode?: "partner" | "brand";
};

function AdSlot({
  id,
  format = "banner",
  title = "Partner placement",
  description = "Placements here fund QUAD and keep the experience free for every verified student on campus.",
  cta = "Talk to our team",
  mode = "partner"
}: AdSlotProps) {
  function contactForSlot() {
    const subject = encodeURIComponent(`QUAD partner placement: ${id}`);
    const body = encodeURIComponent(
      `Hi QUAD team,\r\n\r\nI'm interested in the "${id}" ${format} placement. Please share reach, ICP, and next steps for brands / hiring orgs.\r\n\r\nThanks.`
    );
    window.location.href = `mailto:partners@quad.in?subject=${subject}&body=${body}`;
  }

  return (
    <aside
      className={`ad-slot ad-slot-${format}${mode === "brand" ? " ad-slot--brand" : " ad-slot--partner"}`}
      aria-label="Partner revenue placement (students are never charged)" data-ad-slot={id}
    >
      <div className="ad-slot-head">
        <p className="caps">
          {mode === "brand" ? "BRAND" : "PARTNER FUNDED"}
        </p>
        <span className="ad-slot-id">{id}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="btn btn-ghost ad-slot-cta" type="button" onClick={contactForSlot}>
        {cta}
      </button>
    </aside>
  );
}

export default AdSlot;
