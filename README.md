# Solid Macro Language 
Construct 3D models by cryptic script like [Structure Synth](http://structuresynth.sourceforge.net/)'s Eisen Script. Some lazy language specifications are added. Also includes three.js BufferGeomtry constructor. You can prepare complex 3D models easily and quickly.
## Demonstration
https://keim.github.io/SolidML.js/demo/index.html
## Inspired 
Structure Synth: http://structuresynth.sourceforge.net/
Language Reference: http://structuresynth.sourceforge.net/reference.php
## Many Lazy Syntax Sugers
- "set" => "@"
- "rule" => "#"
- "color red" => "red"
- "blend" => "\*"
- "set maxdepth" => "@"
- "set maxobject" => "@mo"
- "set maxsize/minsize" => "@max/min"
- "set seed" => "@s"
- "set colorpool" => "@cp"
- "set background" => "@bg"
- "36 * {" => "36{"
- space between number and command can be omitted
- box, shpere, cylinder, disc, torus, corn, tetra, octa, dodeca, icosa, line, point are available for shapes key
- mesh, triangle, grid are not implented
- ... and so on
