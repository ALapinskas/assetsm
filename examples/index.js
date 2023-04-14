import { AssetsManager } from "../dist/assetsm.min.js"

// 1. Create a class instance
const assets = new AssetsManager()

// 2. Add files to the queue
assets.addAudio("default", "./knopka-schelchok-korotkii-chetkii-myagkii1.mp3")
assets.addImage("solder", "./SpritesheetGuns.png")
assets.addTileMap("tilemap", "./map.tmj")

// 3. Preload all files you added in the previous step
assets.preload().then(() => {

    // 4. Use 
    const audio = assets.getAudio("default"),
        imageBitmap = assets.getImage("solder"),
        tilemap = assets.getTileMap("tilemap"),
        tilesets = tilemap.tilesets,
        tilesetImages = tilesets.map((tileset) => assets.getImage(tileset.data.name));

    audio.play()

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    //draw image
    ctx.drawImage(imageBitmap,0,0, imageBitmap.width, imageBitmap.height)
    //draw tilesets:
    tilesetImages.forEach((image, idx) => {
        const m = idx + 1;
        ctx.drawImage(image,m*100,m* 100, image.width, image.height)
    })

    document.body.appendChild(canvas) 
})

