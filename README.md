# assets-manager
Tilemaps(.tmj/.json), Images(as ImageBitmaps) and Audio loading and managing.

# How to use

// 1. Create a class instance

const assets = new AssetsManager()

// 2. Register files

assets.addAudio(key, url)
assets.addImage(key, url)
assets.addTileMap(key, url)

// 3. Preload all files you registered in the previous step

assets.preload().then(() => {

// 4. Use files
{
    assets.getAudio(key)
    assets.getImage(key)
    assets.getTileMap(key)
}
// check ./examples/index.js for more detailed example

# Run examples from ./examples folder

1. npm i --save-dev
2. npm start

# Other Notes

* Images are loaded as ImageBitmaps
* When loading tilemaps, it also process tileset files and loads images inside them, attached images could be retrieved by tileset.name key