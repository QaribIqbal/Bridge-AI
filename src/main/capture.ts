import { desktopCapturer, screen } from 'electron';

export async function capturePrimaryScreen(): Promise<Buffer> {
  const display = screen.getPrimaryDisplay();
  const width = Math.max(1, Math.min(Math.round(display.size.width * display.scaleFactor), 1600));
  const height = Math.max(1, Math.min(Math.round(display.size.height * display.scaleFactor), 1000));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });
  const source = sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('No screen was available to capture. Check screen recording permission.');
  }
  return source.thumbnail.toPNG();
}
