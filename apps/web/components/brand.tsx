export function Brand() {
  return <a className="brand" href="/" aria-label="Knct’d home">
    {/* A decorative mark accompanies the accessible wordmark. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/brand/icon.png" width="40" height="40" alt="" />
    <span>Kn<span className="brandCopper">ct’</span>d</span>
  </a>;
}
