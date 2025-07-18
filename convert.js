import sharp from 'sharp';

sharp('image/07.jpg')
  .jpeg({ quality: 100, mozjpeg: true })
  .toFile('image/output.jpg', (err, info) => {
    if (err) throw err;
    console.log(info);
  });

async function convertImageToWebP() {
    try {
        const data = await sharp('image/07.jpg')
        .webp({ quality: 100 })
        .toBuffer();
        console.log('Image converted to WebP format successfully');
    } catch (error) {
        console.error('Error converting image:', error);
    }
}