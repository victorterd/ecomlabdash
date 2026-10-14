/** Scoate un parametru din adresa curentă fără navigare (ex. `?nou=1` după ce formularul s-a închis). */
export function dropSearchParam(name: string) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}
