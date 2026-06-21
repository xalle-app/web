import { IS_CAPACITOR } from "./config.js";

let _plugin = null;

async function getPlugin() {
  if (!IS_CAPACITOR) return null;
  if (_plugin) return _plugin;
  try {
    const mod = await import("@aparajita/capacitor-biometric-auth");
    _plugin = mod.BiometricAuth;
    return _plugin;
  } catch {
    return null;
  }
}

export async function checkBiometryAvailable() {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.checkBiometry();
    return result.isAvailable === true;
  } catch {
    return false;
  }
}

export async function authenticate(reason) {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("unavailable");
  await plugin.authenticate({
    reason: reason || "Подтвердите личность",
    cancelTitle: "Отмена",
    allowDeviceCredential: false,
  });
}
