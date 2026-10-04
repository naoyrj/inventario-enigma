const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (
  req,
  file,
  cb
) => {
  const tiposPermitidos = [
    "image/jpeg",
    "image/png"
  ];

  if (
    !tiposPermitidos.includes(
      file.mimetype
    )
  ) {
    return cb(
      new Error(
        "Solo se permiten imágenes JPG, JPEG o PNG"
      )
    );
  }

  cb(null, true);
};

const uploadImagenProducto =
  multer({
    storage,

    limits: {
      fileSize:
        5 * 1024 * 1024
    },

    fileFilter
  });

module.exports = {
  uploadImagenProducto
};