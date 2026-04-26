function canVibrate() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function hapticTap() {
  if (canVibrate()) navigator.vibrate(10);
}

export function hapticSuccess() {
  if (canVibrate()) navigator.vibrate([12, 30, 18]);
}

export function hapticError() {
  if (canVibrate()) navigator.vibrate([20, 20, 20]);
}
