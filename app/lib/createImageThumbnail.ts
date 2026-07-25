export async function createImageThumbnail(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.8,
): Promise<Blob> {
  const image = await createImageBitmap(file);

  const scale = Math.min(
    maxWidth / image.width,
    maxHeight / image.height,
    1,
  );

  const width = Math.max(
    1,
    Math.round(image.width * scale),
  );

  const height = Math.max(
    1,
    Math.round(image.height * scale),
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Canvas context를 만들 수 없습니다.",
    );
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height,
  );

  image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "썸네일 생성에 실패했습니다.",
            ),
          );
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}