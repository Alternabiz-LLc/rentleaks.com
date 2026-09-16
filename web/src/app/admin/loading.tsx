/** Shown while a desk module loads: the header and a few rows, shimmering. */
export default function Loading() {
  return (
    <div className="dk-loading" aria-busy="true" aria-label="Loading">
      <div className="dk-skel dk-skel--head" />
      <div className="dk-grid dk-grid--4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dk-skel dk-skel--row" />
        ))}
      </div>
      <div className="dk-skel" style={{ height: 320 }} />
    </div>
  );
}
