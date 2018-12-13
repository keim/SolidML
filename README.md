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
- "#define" => "$"
- "color #ff0" => "#ff0"
- "color red" => "red"
- "color random" => "random" or "#?"
- "blend" => "\*"
- "set maxdepth" => "@"
- "set maxobject" => "@mo"
- "set maxsize/minsize" => "@max/min"
- "set seed 1" => "@s1"
- "set colorpool grayscale" => "@cp:g0"
- "set colorpool randomhue" => "@cp:h0"
- "set colorpool list:blue,red" => "@cp[blue,red]"
- "set background" => "@bg"
- "rule R1 weight 2 maxdepth 10 > R2" => "#R1@w2@10>R2"
- "36 * {" => "36{"
- space between number and command can be omitted
## Additional concept
- box, shpere, mesh, tube, triangle, line, grid, cylinder, cone, torus, tetra, octa, dodeca and icosa are available as the built-in rules
- cmesh (cylinder mesh) and ctube (cylinder tube) are available
- mesh(cmesh) is under the effect of scaling, tube(ctube) is not (constant width).
- point is not implemented
- "set colorpool image:" is not implemented
- "shpere:16" sets the segment count of 16, "cylinder:n", "cone:n", "mesh:n", "cmesh:n", "tube:n", "ctube:n" are also available
- "grid:10" sets the edge width in percentage, "line:10" sets the line width in percentage
- "torus[width,seg1,seg2]" for torus shape
- "@cp:g5" sets the grayscale colorpool table in 5 tone-steps, "@cp:g0" means no tone-steps.
- blending only one member sat, bri or hue by "*s0.5,0.1"
- ... and so on
## only for demonstration
- "@bg[#HEX,#HEX,#HEX]" sets sky, floor and checker board colors.
- "@mat[10,90,50,30]" sets material metalness, roughness, clearCoat and clearCoatRoughness in percentage
- "@ao[2,0]" sets ambient occlusion parameters, 0 of the 1st parameter sets disabled.
## API Reference
https://keim.github.io/SolidML/jsdoc/index.html
