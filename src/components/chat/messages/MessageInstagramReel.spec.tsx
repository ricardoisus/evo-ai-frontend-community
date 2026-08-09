import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Attachment } from '@/types/chat/api';
import MessageInstagramReel from './MessageInstagramReel';

const reelAttachment: Attachment = {
  id: 'reel-1',
  message_id: 'message-1',
  file_type: 'ig_reel',
  extension: null,
  data_url: 'https://www.instagram.com/reels/ABC123/?igsh=test',
  thumb_url: null,
  file_size: 0,
  fallback_title: 'Instagram Reel',
  coordinates_lat: 0,
  coordinates_long: 0,
  external_url: 'https://www.instagram.com/reels/ABC123/?igsh=test',
  meta: {
    canonical_url: 'https://www.instagram.com/reel/ABC123/',
    preview_image_url: 'https://cdninstagram.example/reel.jpg',
    title: 'Vetorial Reel',
  },
};

describe('MessageInstagramReel', () => {
  it('renders the server preview and opens the canonical Reel URL', () => {
    render(<MessageInstagramReel attachments={[reelAttachment]} />);

    expect(screen.getByRole('img', { name: 'Prévia do Instagram Reel' })).toHaveAttribute(
      'src',
      'https://cdninstagram.example/reel.jpg',
    );
    expect(screen.getByRole('link', { name: 'Abrir Vetorial Reel no Instagram' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/reel/ABC123/',
    );
  });

  it('rejects non-Instagram URLs instead of rendering an unsafe link', () => {
    render(
      <MessageInstagramReel
        attachments={[{ ...reelAttachment, external_url: 'https://example.com/reel', data_url: 'https://example.com/reel', meta: {} }]}
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('prefers the cached thumbnail and replaces a failed image with the fallback artwork', () => {
    render(
      <MessageInstagramReel
        attachments={[{ ...reelAttachment, thumb_url: 'https://evo-api.example/cached-reel.jpg' }]}
      />,
    );

    const image = screen.getByRole('img', { name: 'Prévia do Instagram Reel' });
    expect(image).toHaveAttribute('src', 'https://evo-api.example/cached-reel.jpg');

    fireEvent.error(image);
    expect(screen.queryByRole('img', { name: 'Prévia do Instagram Reel' })).not.toBeInTheDocument();
  });
});
