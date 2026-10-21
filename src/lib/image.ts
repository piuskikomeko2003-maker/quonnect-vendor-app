export async function resizeImageFile(
  file: File,
  maxSize = 420,
  quality = 0.72,
  square = false,
): Promise<{ dataUrl: string; blob: Blob }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not open that image"));
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  if (square) {
    canvas.width = maxSize;
    canvas.height = maxSize;
    const side = Math.min(image.width, image.height);
    canvas
      .getContext("2d")
      ?.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        maxSize,
        maxSize,
      );
  } else {
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  const jpeg = canvas.toDataURL("image/jpeg", quality);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not resize image"))), "image/jpeg", quality);
  });

  return { dataUrl: jpeg, blob };
}
