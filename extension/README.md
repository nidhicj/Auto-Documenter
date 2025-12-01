# AutoDoc AI Chrome Extension

## Building the Extension

Before loading the extension in Chrome, you **must** build it first:

```bash
# Install dependencies (only needed once)
npm install

# Build the extension
npm run build
```

This compiles the TypeScript source files into JavaScript modules that Chrome can load.

## Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the **`extension/dist`** directory

⚠️ **Important**: Load the `dist` folder, not the root `extension` folder.

## Development

For development with auto-rebuild on file changes:

```bash
npm run dev
```

Then reload the extension in Chrome after each build completes.

## Troubleshooting

### "Cannot use import statement outside a module"

This error means you're trying to load the TypeScript source files instead of the built JavaScript files.

**Solution**:
1. Run `npm run build` in the extension directory
2. Load the `extension/dist` folder in Chrome (not the `extension` folder)

### Extension not working after code changes

After modifying the source code:
1. Rebuild: `npm run build`
2. Go to `chrome://extensions/`
3. Click the reload icon on the AutoDoc AI extension card
