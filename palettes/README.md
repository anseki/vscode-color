# Color Palette for VS Code Color Picker extension

Files in this directory are loaded as color palettes. Each of those files is parsed as one color palette, and its palette name is added to a drop-down list on the Color Picker to switch those.  
When a file was removed from this directory, its palette name is also removed from the drop-down list.  
(A built-in color palette "CSS Colors" can not be removed.)

Supported file formats:

- [YAML](#yaml): This suits if you will write a color palette file manually. It is human readable and writable format.
- [CSV](#csv-tsv): This suits if you have a simple list of colors.
- [TSV](#csv-tsv): This also suits case of CSV.
- [JSON](#json): This suits if you will generate a color palette programmatically.

## YAML

Files which have a `.palette.yml` at the end of the file name are parsed as [YAML](http://yaml.org/) format.

Top-level-structure must be sequence structure.

```yaml
- "@<palette-name>"
- <color>
- <color>
    :
    :
```

Each `<color>` element can be one of following structure:

### String

A string is parsed as a supported notation.

For example:

```yaml
- blue                   # CSS named color
- rgba(237, 10, 63, 0.8) # RGB function
- "#11aabb"              # RGB-Hex (It is quoted to avoid `#` is interpreted as a comment.)
```

### Sequence

If a first element of the sequence is a string, that is parsed as a supported notation.  
If the sequence has a second element that is a string, that is shown as a name of the color when a mouse hovers on the color palette.

For example:

```yaml
-
  - rgb(195, 33, 72)
  - Maroon
-
  - rgb(51, 154, 204)
  - Cerulean Blue
-
  - rgb(141, 144, 161) # Since a name isn't given, a sequence number `#3` is shown.
```

If first, second and third elements of the sequence are numbers, those are parsed as RGB color channels of the color, the useful range of the value is `0` to `1`.  
If the sequence has fourth element that is a string, that is shown as a name of the color when a mouse hovers on the color palette.

If the sequence has fourth element that is a number, that is parsed as an alpha channel of the color, the useful range of the value is `0` to `1`. And, if the sequence has fifth element that is a string, that is shown as a name of the color.

For example:

```yaml
-
  - 0.74 # R
  - 0.60 # G
  - 0.37 # B

# Or, you might like flow styles (one-line notation)
- [ 0.74, 0.60, 0.37 ]

- [ 0.13, 0.55, 0.13, Forest Green ] # Has name
- [ 0.13, 0.55, 0.13, 0.8, Ghost Green ] # Has alpha channel and name
```

### Mapping

The mapping can specify a color by using one of following keys or keys-set:

- If a `color` key points a string, that is parsed as a supported notation.
- If `r`, `g` and `b` keys point numbers, those are parsed as RGB color channels of the color.
- If `h`, `s` and `b` (or `v`) keys point numbers, those are parsed as HSB (HSV) color channels of the color.
- If `h`, `s` and `l` keys point numbers, those are parsed as HSL color channels of the color.
- If `h`, `w` and `b` keys point numbers, those are parsed as HWB color channels of the color.
- If `c`, `m`, `y` and `k` keys point numbers, those are parsed as CMYK color channels of the color.
- If a `s` key points a number (and `h`, `b`, `v` and `l` keys don't point number), that is parsed as a Gray-shade channel of the color.

The useful range of all numbers above is `0` to `1`.

And following keys also are parsed if the mapping has it:

- A number an `a` key points is parsed as an alpha channel of the color, the useful range of the value is `0` to `1`.
- A string a `name` key points is shown as a name of the color when a mouse hovers on the color palette.

For example:

```yaml
- color: "#009dc4"
  name: Pacific Blue

- r: 0
  g: 0.584
  b: 0.718
  name: Blue-Green

# Or, you might like flow styles (one-line notation)
- { h: 0.935, s: 0.917, l: 0.622, a: 0.9, name: Violet Red }
```

### Palette Name

A color palette can have a palette name that is added to a drop-down list on the Color Picker.  
That must be specified as a string to which an `@` is added to the start of it, at first element of the top-level sequence.  
Note that it must be quoted to avoid `@` is interpreted as a indicator in YAML.

For example, the color palette has a name "My Website":

```yaml
- "@My Website"
- [ gray, Background Color ]
- [ blue, Button Color ]
- [ black, Text Color ]
```

If a name is not specified, the file name without `.palette.yml` is used as a palette name.  
Also, a file name to which an `@` is added to the start of it (e.g. `@Crayola.palette.yml`) specifies its palette name clearly. That is useful to find the palette name quickly even if the file is large size.

## CSV/TSV

Files which have a `.palette.csv` at the end of the file name are parsed as [CSV](http://tools.ietf.org/html/rfc4180) (Comma-Separated Values) format, and files which have a `.palette.tsv` at the end of the file name are parsed as TSV (Tab-Separated Values) format. These two formats differ in only the field (column) separator.

All lines are parsed as with [Sequence of YAML](#sequence).

For example, CSV format:

```csv
#11aabb
gray,Background Color
"rgb(195, 33, 72)",Maroon
```

Note that the string at third line is quoted to avoid `,` are interpreted as separators.

The CSV color palette above is equivalent to following YAML color palette:

```yaml
-
  - "#11aabb"
-
  - gray
  - Background Color
-
  - rgb(195, 33, 72)
  - Maroon
```

### Palette Name

A color palette can have a palette name that is added to a drop-down list on the Color Picker.  
That must be specified as a string to which an `@` is added to the start of it, at first line.

For example, the color palette has a name "My Website":

```csv
@My Website
gray,Background Color
blue,Button Color
black,Text Color
```

If a name is not specified, the file name without `.palette.csv` or `.palette.tsv` is used as a palette name.  
Also, a file name to which an `@` is added to the start of it (e.g. `@Crayola.palette.csv`) specifies its palette name clearly. That is useful to find the palette name quickly even if the file is large size.

## JSON

Files which have a `.palette.json` at the end of the file name are parsed as [JSON](#http://json.org/) format.

Top-level-structure must be array structure.  
Each element of the array can be one of following structure:

- A string is parsed as with [String of YAML](#string).
- An array is parsed as with [Sequence of YAML](#sequence).
- An object is parsed as with [Mapping of YAML](#mapping).

For example:

```json
[
  "blue",
  "#11aabb",

  [ "rgb(195, 33, 72)", "Maroon" ],
  [ 0.13, 0.55, 0.13, 0.8, "Ghost Green" ],

  {
    "color": "#009dc4",
    "name": "Pacific Blue"
  },
  {
    "h": 0.935,
    "s": 0.917,
    "l": 0.622,
    "a": 0.9,
    "name": "Violet Red"
  }
]
```

### Palette Name

A color palette can have a palette name that is added to a drop-down list on the Color Picker.  
That must be specified as a string to which an `@` is added to the start of it, at first element of the top-level array.

For example, the color palette has a name "My Website":

```json
[
  "@My Website",
  [ "gray", "Background Color" ],
  [ "blue", "Button Color" ],
  [ "black", "Text Color" ]
]
```

If a name is not specified, the file name without `.palette.json` is used as a palette name.  
Also, a file name to which an `@` is added to the start of it (e.g. `@Crayola.palette.json`) specifies its palette name clearly. That is useful to find the palette name quickly even if the file is large size.
