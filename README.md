# Color Picker for VS Code

Helper with GUI to generate color codes such as CSS color notations.

A dialog box is shown by pressing `Alt + C P` keys or command `Pick Color`. If a cursor is positioned on a text that is color notation at that time, that text is selected as target for editing.

![s-01](s-01.gif)

* Supported color spaces for editing the color: HSB (HSV), RGB, Lab, and CMYK. With alpha channel.
* Supported color notations for outputting the color: `hsb()`/`hsba()`, `hsl()`/`hsla()`, `hwb()`, `rgb()`/`rgba()`, RGB-Hex 3/4/6/8 digits, CSS Named Color, `device-cmyk()` and `gray()`.
* Custom color palettes supported.
* Multiple cursors supported.

![s-02](s-02.gif)

## Install

You need [Node.js](https://nodejs.org/) installed and available in your `$PATH`.  
Then, launch the Command Pallete (`Ctrl + Shift + P` or `Cmd + Shift + P`) and type `ext install`, and then look for "Color Picker".

## Usage

A dialog box is shown by pressing `Alt + C P` keys or command `Pick Color`.  
If a cursor is positioned on a text that is color notation at that time, that text is selected as target for editing. The color notation is recognized even if it includes line-breaks and comments.  
For example:

```css
background-color: hsl(
  136,
  77%, /* When it is blurred, change to 32% */
  84%
  );
```

Multiple cursors also supported.

You can see tooltip information for some controls in the dialog box by hovering a mouse on those.

## Options

You can specify following options by User Settings or Workspace Settings.

### `colorHelper.pickerForm`

A name of preset package that switches UI and features.  
Allowed values are:

* `default`

![default](s-default.png)

* `largePalette`

![largePalette](s-largePalette.png)

* `simple`

![simple](s-simple.png)

* `compact`

![compact](s-compact.png)

* `compact2`

![compact2](s-compact2.png)

* `byPalette`

![byPalette](s-byPalette.png)

### `colorHelper.storeDir`

A path to directory that contains your color palettes.  
For information about color palettes, see `README.md` that is found in that directory.

### `colorHelper.resident`

Stands by for a quick response.  
After the dialog box is opened, it stays in memory even after it is closed until VS Code is exited (or VS Code might unload it).
