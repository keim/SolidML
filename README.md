# Solid Macro Language 
Construct fractal-like 3D models by cryptic script based on [Structure Synth](http://structuresynth.sourceforge.net/)'s Eisen Script. It has a backward compatibility with Eisen Script, and some lazy language specifications (syntax sugers) are added.
You can prepare complex 3D models easily and quickly.
## Demonstration
https://keim.github.io/SolidML/demo/index.html
## Based on and respect for
Structure Synth: http://structuresynth.sourceforge.net/
Eisen Script: http://structuresynth.sourceforge.net/reference.php
## Many Lazy Syntax Sugers
- "set" => "@"
- "rule" => "#"
- "color #ff0" => "#ff0"
- "color red" => "red"
- "color random" => "random" or "#?"
- "blend" => "\*"
- "set maxdepth" => "@"
- "set maxobject" => "@mo"
- "set maxsize/minsize" => "@max/min"
- "set seed 1" => "@s1"
- "set colorpool grayscale" => "@cp:g"
- "set colorpool randomhue" => "@cp:h"
- "set colorpool list:blue,red" => "@cp[blue,red]"
- "set background" => "@bg"
- "rule R1 weight 2 maxdepth 10 > R2" => "#R1@w2@10>R2"
- "36 * {" => "36{"
- space between number and command can be omitted
## Additional concept
- box, shpere, cylinder, disc, torus, corn, tetra, octa, dodeca, icosa are available as the built-in rules
- mesh, triangle, grid, line, point are not implemented
- "set colorpool image:" is not implemented
- blending only one member sat, bri or hue by "*s#f00,0.1"
- ... and so on
## API Reference
https://keim.github.io/SolidML/jsdoc/index.html
