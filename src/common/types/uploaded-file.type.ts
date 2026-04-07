export type UploadedFile = {
  originalname: string;
  size: number;
  mimetype?: string;
  path?: string;
  buffer: Buffer;
};
