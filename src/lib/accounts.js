const KEY = "xalle.accounts";

export function getAccounts() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function saveAccount(session) {
  if (!session?.token || !session?.user) return;
  const list = getAccounts().filter(a => a.userId !== session.user.id);
  list.unshift({ token: session.token, userId: session.user.id, handle: session.user.handle, name: session.user.name, avatarUrl: session.user.avatar_url || null });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)));
}

export function removeAccount(userId) {
  const list = getAccounts().filter(a => a.userId !== userId);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function updateAccountToken(userId, token) {
  const list = getAccounts();
  const acc = list.find(a => a.userId === userId);
  if (acc) { acc.token = token; delete acc.expired; localStorage.setItem(KEY, JSON.stringify(list)); }
}

export function markAccountExpired(userId) {
  const list = getAccounts();
  const acc = list.find(a => a.userId === userId);
  if (acc) { acc.expired = true; localStorage.setItem(KEY, JSON.stringify(list)); }
}

export function markAccountValid(userId) {
  const list = getAccounts();
  const acc = list.find(a => a.userId === userId);
  if (acc) { delete acc.expired; localStorage.setItem(KEY, JSON.stringify(list)); }
}
