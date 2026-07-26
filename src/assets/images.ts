const iconImages = import.meta.glob("./icons/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const editionImages = import.meta.glob("./editions/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function imageFrom(
  images: Record<string, string>,
  directory: "icons" | "editions",
  id: string,
) {
  return (
    images[`./${directory}/${id}.png`] ?? images[`./${directory}/custom.png`]
  );
}

export function iconImage(id: string) {
  return imageFrom(iconImages, "icons", id);
}

export function editionImage(id: string) {
  return imageFrom(editionImages, "editions", id);
}
