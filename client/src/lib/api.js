export async function scanRepo(url) {
  const response = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ type: 'UNKNOWN', error: 'Something went wrong' }));
    throw error;
  }

  return response.json();
}
