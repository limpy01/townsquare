import path from "node:path";

import sharp from "sharp";

import { playerIdSchema } from "@townsquare/contracts";

const MAX_MESSAGE_BYTES = 1024 * 1024;
const DEFAULT_AVATAR_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#34261d"/><circle cx="256" cy="190" r="100" fill="#c5a16d"/><path d="M65 500c25-135 113-205 191-205s166 70 191 205" fill="#c5a16d"/></svg>',
);

function parseAvatarDataUrl(dataUrl: unknown): Buffer {
  if (typeof dataUrl !== "string") {
    throw new Error("Avatar must be a data URL.");
  }

  const match = dataUrl.match(
    /^data:image\/(?:png|jpeg|jpg|webp);base64,([a-z0-9+/=\s]+)$/i,
  );
  const encodedImage = match?.[1];
  if (!encodedImage) throw new Error("Unsupported avatar format.");

  const buffer = Buffer.from(encodedImage.replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_MESSAGE_BYTES) {
    throw new Error("Avatar is too large.");
  }
  return buffer;
}

export interface AvatarService {
  getDefaultAvatar(): Promise<Buffer>;
  saveAvatar(playerId: string, uploadContent: unknown): Promise<string>;
}

export function createAvatarService(avatarDir: string): AvatarService {
  let defaultAvatar: Buffer | undefined;

  return {
    async getDefaultAvatar() {
      if (!defaultAvatar) {
        defaultAvatar = await sharp(DEFAULT_AVATAR_SVG)
          .webp({ quality: 85 })
          .toBuffer();
      }
      return defaultAvatar;
    },
    async saveAvatar(playerId, uploadContent) {
      const parsedPlayerId = playerIdSchema.parse(playerId);
      const source = parseAvatarDataUrl(uploadContent);
      const filename = `${parsedPlayerId}.webp`;
      await sharp(source, { limitInputPixels: 4096 * 4096 })
        .rotate()
        .resize(512, 512, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(avatarDir, filename));
      return filename;
    },
  };
}
