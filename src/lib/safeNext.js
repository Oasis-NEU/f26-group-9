// Only allow same-site relative redirects from ?next= (no open redirects).
export function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}
