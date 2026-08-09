import React, { useState } from 'react';
import { ExternalLink, Instagram, Play } from 'lucide-react';

import type { Attachment } from '@/types/chat/api';

interface MessageInstagramReelProps {
  attachments: Attachment[];
}

const normalizeInstagramUrl = (value?: string): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'instagram.com' && !hostname.endsWith('.instagram.com')) return null;

    url.protocol = 'https:';
    url.pathname = url.pathname.replace(/^\/reels\//, '/reel/');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const decodeHtmlEntities = (value: string): string => value.replace(/&amp;/g, '&');

const ReelArtwork: React.FC<{ previewImage: string }> = ({ previewImage }) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (!previewImage || imageFailed) {
    return (
      <div className="flex aspect-[2.4/1] items-center justify-center bg-gradient-to-br from-primary/25 via-secondary to-accent">
        <Instagram className="h-10 w-10 text-foreground/80" />
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden bg-muted">
      <img
        src={decodeHtmlEntities(previewImage)}
        alt="Prévia do Instagram Reel"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white backdrop-blur-sm">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      </span>
    </div>
  );
};

const MessageInstagramReel: React.FC<MessageInstagramReelProps> = ({ attachments }) => {
  const reels = attachments.flatMap(attachment => {
    if (attachment.file_type !== 'ig_reel') return [];

    const metadata = attachment.meta ?? {};
    const url = normalizeInstagramUrl(
      String(
        metadata.canonical_url ||
          attachment.external_url ||
          attachment.data_url ||
          metadata.original_url ||
          '',
      ),
    );
    if (!url) return [];

    const previewImage = String(attachment.thumb_url || metadata.preview_image_url || '').trim();
    const title = String(metadata.title || attachment.fallback_title || 'Instagram Reel');
    const description = String(metadata.description || '').trim();
    return [{ attachment, url, previewImage, title, description }];
  });

  if (reels.length === 0) return null;

  return (
    <div className="space-y-2">
      {reels.map(({ attachment, url, previewImage, title, description }, index) => (
        <a
          key={attachment.id || index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${title} no Instagram`}
          className="group block w-[min(360px,calc(100vw-120px))] min-w-[230px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ReelArtwork previewImage={previewImage} />

          <div className="p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Instagram className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{title}</span>
                {description ? (
                  <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                    {description}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs text-muted-foreground">instagram.com</span>
                )}
              </span>
              <ExternalLink className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </div>
        </a>
      ))}
    </div>
  );
};

export default MessageInstagramReel;
