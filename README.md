# Color Picker for VS Code

[![VS Marketplace](http://vsmarketplacebadge.apphb.com/version-short/anseki.vscode-color.svg)](https://marketplace.visualstudio.com/items?itemName=anseki.vscode-color) [![installs](http://vsmarketplacebadge.apphb.com/installs-short/anseki.vscode-color.svg)](https://marketplace.visualstudio.com/items?itemName=anseki.vscode-color) [![GitHub issues](https://img.shields.io/github/issues/anseki/vscode-color.svg)](https://github.com/anseki/vscode-color/issues) [![David](https://img.shields.io/david/anseki/vscode-color.svg)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE-MIT)

Helper with GUI to generate color codes such as CSS color notations.  
And, a command [`Convert Color`](#convert-color) to change the color notation.

A dialog box is shown by pressing `Alt + C P` keys or command `Pick Color`. If a cursor is positioned on a string that is color notation at that time, that string is selected as target for editing.

![s-01](s-01.gif)

* Supported color spaces to edit the color: HSB (HSV), RGB, Lab, and CMYK. With alpha channel.
* Supported color notations to output the color: `hsb()`/`hsba()`, `hsl()`/`hsla()`, `hwb()`, `rgb()`/`rgba()`, RGB-Hex 3/4/6/8 digits, CSS Named Color, `device-cmyk()` and `gray()`.
* Custom [color palettes](#color-palettes) supported.
* [`Convert Color`](#convert-color) command to change the color notation supported.
* Multiple cursors supported.

![s-02](s-02.gif)

## Install

You need [Node.js](https://nodejs.org/) (including NPM) installed and available in your `$PATH`.  
**Note:** If you use a Node Version Manager (e.g. nvm), the Node.js might not be available in a process VS Code will run, until you make it. (Especially in **Windows 10 / Vista**, the NPM might not be available.)

Then, launch the Command Pallete (`Ctrl + Shift + P` or `Cmd + Shift + P`) and type `ext install`, and then look for "Color Picker".  
**Note:** If a few NPM modules that the extension uses are not found in your computer, those will be installed automatically. Then, only when first launching, it may take some little time for setting up. (**Please wait for the finish** without closing VS Code.)

## Usage

A dialog box is shown by pressing `Alt + C P` keys (press <kbd>P</kbd> after release <kbd>Alt</kbd> and <kbd>C</kbd>) or command `Pick Color`.  
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

When a cursor or multiple cursors are positioned on strings that are color notation, press `Alt + C C` (press <kbd>C</kbd> after release <kbd>Alt</kbd> and <kbd>C</kbd>) keys or run a command `Convert Color`.  
Then a list of color notations is shown. The target strings are converted to each color with the notation you chose.

![s-03](s-03.gif)

It is converted with the notation you chose and current state of `Pick Color` dialog box.  
For example, you turned on an `UC` (upper-case) checkbox of `RGB-Hex` in the dialog box, and you invoked the command `Convert Color` with a string `white` as a target and `RGB-Hex` notation, then that `white` is converted to `#FFF`. If you turned off that checkbox, it is converted to `#fff`.

![s-04](s-04.png)

## Color palettes

You can create custom color palettes. Also, you can specify color palettes that are loaded always, or color palettes that are loaded for only a project.  
For example, a color palette as a design theme (or template) for your website is loaded only when that website project is being opened by VS Code.  
See [`colorHelper.storeDir`](#colorhelperstoredir) option.

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

## Rendering trouble

If your GPU driver has a problem, the dialog box might not be shown correctly. The following options try to avoid the problem.  
**Note:** You should **not use these** if there is no problem. Also, it is not a solution to the root of the problem, and it might not solve the problem.

**Steps:**

1. If the dialog box is not shown correctly, set `colorHelper.disableGpu` to `1`.
2. If that wasn't solved yet, set `colorHelper.disableShadow` to `true`.
3. If that wasn't solved yet, set `colorHelper.disableTransparent` to `true`.
4. If that wasn't solved yet, please visit [support page](https://github.com/anseki/vscode-color/issues).

### `colorHelper.disableGpu`

If `1` is specified, disable GPU rendering on Windows. By default (`-1`), it is switched automatically dependent on current platform.

### `colorHelper.disableShadow`

If `true` is specified, disable drop shadow effect of the dialog box.

### `colorHelper.disableTransparent`

If `true` is specified, disable transparent window as the dialog box.
