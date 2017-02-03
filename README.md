# Color Picker for VS Code

[![VS Marketplace](http://vsmarketplacebadge.apphb.com/version-short/anseki.vscode-color.svg)](https://marketplace.visualstudio.com/items?itemName=anseki.vscode-color) [![installs](http://vsmarketplacebadge.apphb.com/installs/anseki.vscode-color.svg)](https://marketplace.visualstudio.com/items?itemName=anseki.vscode-color) [![GitHub issues](https://img.shields.io/github/issues/anseki/vscode-color.svg)](https://github.com/anseki/vscode-color/issues) [![David](https://img.shields.io/david/anseki/vscode-color.svg)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE-MIT)

Helper with GUI to generate color codes such as CSS color notations.  
And, a command [`Convert Color`](#convert-color) to change the color notation.

A dialog box is shown by pressing `Alt + C P` keys or command `Pick Color`. If a cursor is positioned on a string that is color notation at that time, that string is selected as target for editing.

![s-01](s-01.gif)

* Supported color spaces to edit the color: HSB (HSV), RGB, Lab, and CMYK. With alpha channel.
* Supported color notations to output the color: `hsb()`/`hsba()`, `hsl()`/`hsla()`, `hwb()`, `rgb()`/`rgba()`, RGB-Hex 3/4/6/8 digits, CSS Named Color, `device-cmyk()` and `gray()`.
* Custom color palettes supported.
* Multiple cursors supported.

![s-02](s-02.gif)

## Install

You need [Node.js](https://nodejs.org/) (including NPM) installed and available in your `$PATH`.  
**Note:** If you use a Node Version Manager (e.g. nvm), the Node.js might not be available in a process VS Code will run, until you make it.

Then, launch the Command Pallete (`Ctrl + Shift + P` or `Cmd + Shift + P`) and type `ext install`, and then look for "Color Picker".  
**Note:** If a few NPM modules that the extension uses are not found in your computer, those will be installed automatically. Then, only when first launching, it may take some little time for setting up. (Wait for the finish without closing VS Code.)

## Usage

A dialog box is shown by pressing `Alt + C P` keys or command `Pick Color`.  
If a cursor is positioned on a string that is color notation at that time, that string is selected as target for editing. The color notation is recognized even if it includes line-breaks and comments.  
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

### Convert Color

When a cursor or multiple cursors are positioned on strings that are color notation, press `Alt + C C` keys or run a command `Convert Color`.  
Then a list of color notations is shown. The each target string is converted to a same color with the notation you chose.

![s-03](s-03.gif)

It is converted with the notation you chose and current state of `Pick Color` dialog box.  
For example, you turned on an `UC` (upper-case) checkbox of `RGB-Hex` in the dialog box, and you invoked the command `Convert Color` with a string `white` as a target and `RGB-Hex` notation, then that `white` is converted to `#FFF`. If you turned off that checkbox, it is converted to `#fff`.

![s-04](s-04.png)

## Options

You can specify following options by User Settings or Workspace Settings.

### `colorHelper.pickerForm`

A name of preset package that switches UI and features.  
Allowed values are:

* `"default"`

![default](s-default.png)

* `"largePalette"`

![largePalette](s-largePalette.png)

* `"simple"`

![simple](s-simple.png)

* `"compact"`

![compact](s-compact.png)

* `"compact2"`

![compact2](s-compact2.png)

* `"byPalette"`

![byPalette](s-byPalette.png)

### `colorHelper.storeDir`

A path to directory that contains your color palettes.  
For information about color palettes, see `README.md` that is found in that directory.

### `colorHelper.resident`

Stands by for a quick response.  
After the dialog box is opened, it stays in memory even after it is closed until VS Code is exited (or VS Code might unload it).

### `colorHelper.formatsOrder`

An array that indicates the order of formats in UI (e.g. drop-down list).  
Allowed items are `"hsb"`, `"hsl"`, `"hwb"`, `"rgb"`, `"hex"`, `"named"`, `"cmyk"` or `"gray"`.  
This array doesn't have to contain all formats. The formats that are not contained in the array are moved to the top of the list in UI automatically when it was used. If you want to make the list static, specify all formats in the order you desire, e.g. `["hsb", "hsl", "hwb", "rgb", "hex", "named", "cmyk", "gray"]`.
