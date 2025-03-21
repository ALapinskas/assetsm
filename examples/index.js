// import AssetsManager from "../dist/assetsm.min.js"
import AssetsManager from "../src/AssetsManager.js"
// 1. Create a class instance
const manager = new AssetsManager();

// 2. Add files to the queue
manager.addAudio("default", "./knopka-schelchok-korotkii-chetkii-myagkii1.mp3");
manager.addImage("soldier", "./SpritesheetGuns.png");
manager.addImage("racing", "./spritesheet_tiles_s.png");
manager.addTileMap("tilemapTmj", "./map.tmj"); 
manager.addAtlasXML("atlas", "./img/allSprites_default.xml");
manager.addImage("no_image_url", "./no_such_file.png");
manager.addTileMap("tilemapTmx", "./map.tmx");

// lets say we want to load related tileset separately
// manager.addTileMap("tilemap", "./map.tmj", true); 
// manager.addTileSet("tileset", "./Tileset.tsj");

// 3. Subscribe for progress to track the loading progress status
manager.addEventListener("progress", (event) => {
    console.log("progress, loaded items: ", event.loaded);
    console.log("progress, items left: ", event.total);
});

// 4. Get current pending uploads if necessary
console.log("files, waiting for upload:", manager.filesWaitingForUpload)

// 5. Preload all files you added in the previous step
manager.preload().then(() => {

    // 6. Use 
    const audio = manager.getAudio("default"),
        imageBitmap = manager.getImage("soldier"),
        tilemapTmj = manager.getTileMap("tilemapTmj"),
        tilesetSep = manager.getTileSet("tileset"),
        racingImage = manager.getImage("racing"),
        tilesets = tilemapTmj.tilesets,
        tilesetImages = tilesets.map((tileset) => tilesetSep ? manager.getImage(tilesetSep.name): manager.getImage(tileset.name)),
        atlasImageMap = manager.getAtlasImageMap("atlas"),
        tankBody_green = manager.getImage("tankBody_green"),
        tileSand_roadCornerUL = manager.getImage("tileSand_roadCornerUL"); // atlasImageMap.tankBody_green

    audio.play();

    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    //draw image
    ctx.drawImage(imageBitmap,0,0, imageBitmap.width, imageBitmap.height);
    //draw tilesets:
    tilesetImages.forEach((image, idx) => {
        const m = idx + 1;
        ctx.drawImage(image,m*100,m* 100, image.width, image.height);
    });

    ctx.drawImage(racingImage, 300, 0);
    //console.log(barrelBlack_sideImage);
    //ctx.putImageData(tankBody_green, 0, 0);
    ctx.drawImage(tileSand_roadCornerUL, 150, 0, tankBody_green.width, tankBody_green.height);
    ctx.drawImage(tankBody_green, 170, 0, tankBody_green.width, tankBody_green.height);
    //const test = ctx.getImageData(0, 0, 200, 200);
    //console.log(test);
    //ctx.putImageData(test, 200, 0);
    document.body.appendChild(canvas);

    const tilemapTMX = manager.getTileMap("tilemapTmx"),
        tilesetsTMX = tilemapTMX.tilesets,
        tilesetImagesTMX = tilesetsTMX.map((tileset) => manager.getImage(tileset.name));

    const canvasTMX = document.createElement("canvas");
    canvasTMX.width = 600;
    canvasTMX.height = 300;
    const ctx2 = canvasTMX.getContext("2d");
    ctx2.fillRect(0, 0, canvasTMX.width, canvasTMX.height);
    //draw tilesets:
    tilesetImagesTMX.forEach((image, idx) => {
        const m = idx + 1;
        ctx2.drawImage(image,m*100,m* 100, image.width, image.height);
    });

    console.log(tilemapTMX);
    console.log(tilemapTmj);
    document.body.appendChild(canvasTMX);
});

/*** new functionality(from 0.1.0): adding custom file types */
const loaderMethodForSpineText = () => { console.log("upload SpineText"); return Promise.resolve("result spine text"); },
    loaderMethodForSpineAtlas = () => { console.log("upload SpineAtlas"); return Promise.resolve("result spine atlas"); };

const manager2 = new AssetsManager();
manager2.registerLoader("SpineText", loaderMethodForSpineText);
manager2.registerLoader("SpineAtlas", loaderMethodForSpineAtlas);
//use default upload fetch method
manager2.registerLoader("ReadmeText");

manager2.addSpineText("defaultSpineText", "./spineText.json");
manager2.addSpineAtlas("defaultSpineAtlas", "./spine.atlas");
manager2.addReadmeText("defaultReadmeKey", "./readme.txt");

manager2.preload().then(() => {
    console.log(manager2.getSpineText("defaultSpineText"));
    console.log(manager2.getSpineAtlas("defaultSpineAtlas"));
    manager2.getReadmeText("defaultReadmeKey").text().then((result) => {
        console.log(result);
    });
});

// wait until other uploads will be finished
setTimeout(() => {
    const loaderWithIncorrectValue =  () => { console.log("upload and return incorrect value"); return {}; };

    manager2.registerLoader("IncorrectValueLoader", loaderWithIncorrectValue);
    manager2.addIncorrectValueLoader("default", "./spineText.json");
    manager2.preload().catch((err) => {
        if (err.message.includes("uploadMethod should be instance of Promise")) {
            console.log("expected, incorrect upload method return value");
        } else {
            console.log("unexpected issue!");
            console.error(err.message);
        }
    });
}, 1000);

// No data preload() should be resolved
setTimeout(() => {
    const manager3 = new AssetsManager();
    console.log("no data preload started");
    new Promise((res, rej) => {
        setTimeout(() => {
            rej("empty preload doesn't resolves!");
        }, 1000);
        manager3.preload().then(() => {
            console.log("no data preload resolved");
            res();
        }).catch((err) => {
            console.log("unexpected issue!");
            console.error(err.message);
            rej("unexpected issue!");
        });
    });
}, 1500);