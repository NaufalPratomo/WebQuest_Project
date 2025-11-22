// In-memory auth store replacing previous localStorage usage
// Note: Session will be lost on full page reload unless enhanced with cookies.

let _token: string | null = null;
let _user: { _id: string; id: string; name: string; role: string } | null = null;

export function setToken(t: string | null) {
  _token = t;
}
export function getToken(): string | null {
  return _token;
}
export function setUser(u: { _id: string; name: string; role: string } | null) {
  if (u) {
    _user = { ...u, id: u._id };
    // expose for logger fallback
    (window as any).__AUTH_USER = _user;
  } else {
    _user = null;
    (window as any).__AUTH_USER = null;
  }
}
export function getUser() {
  return _user;
}
