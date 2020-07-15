// from https://github.com/jasondavies/newick.js/
function parseNewick(s) {
    var ancestors = [];
    var tree = {};
    var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
    for (var i=0; i<tokens.length; i++) {
        var token = tokens[i];
        switch (token) {
            case '(': // new branchset
                var subtree = {};
                tree.branchset = [subtree];
                ancestors.push(tree);
                tree = subtree;
                break;
            case ',': // another branch
                var subtree = {};
                ancestors[ancestors.length-1].branchset.push(subtree);
                tree = subtree;
                break;
            case ')': // optional name next
                tree = ancestors.pop();
                break;
            case ':': // optional length next
                break;
            default:
                var x = tokens[i-1];
                if (x == ')' || x == '(' || x == ',') {
                    tree.name = token;
                } else if (x == ':') {
                    tree.length = parseFloat(token);
                }
        }
    }
    return tree;
}


function isTip(tree) {
    return !(_.keys(tree).includes("branchset"));
}

function setUltrametricTreeDepths(tree) {
    if (!isTip(tree)) {
        var my_depth = 0;
        tree["branchset"].forEach(function(child) {
            setUltrametricTreeDepths(child);
            my_depth = my_depth + child["depth"]
        });
        tree["depth"] = my_depth;
    } else {
        tree["depth"] = 1;
    }
}

function generateLinearCoords(tree) {
    var maxDepth = tree["depth"]; // at root
    var leafIndex = 0;
    
    function setLinearCoord(tree) {
        tree["x"] = maxDepth - tree["depth"]
        if (!isTip(tree)) {
            // internal node
            var childrenHeights = [];
            tree["branchset"].forEach(function(child) {
                setLinearCoord(child);
                childrenHeights.push(child["y"])
            });
            tree["y"] = (Math.max(...childrenHeights) + Math.min(...childrenHeights))/2;
        } else {
            // am a tip
            tree["y"] = leafIndex;
            leafIndex++;
            tree["x"] = tree["x"] + 30
        }
    }
    setLinearCoord(tree);
}


function plotDendro(newick, div, radial, mapping, nodeColor) {
    var tree = parseNewick(newick);
    setUltrametricTreeDepths(tree);
    generateLinearCoords(tree);
    
    var x = [];
    var y = [];
    var names = [];
    var colors = [];
    var nodeSizes = [];
    
    var internalNodeSize = 5;
    var tipSize = 6.3;
    
    function nodeCoords(tree) {
        names.push(tree["name"]);
        x.push(tree["x"]);
        y.push(tree["y"]);
        
        if (!isTip(tree)) {
            colors.push("#a4a4a4");
            nodeSizes.push(internalNodeSize);
            tree["branchset"].sort(function(a, b) {return a["depth"] - b["depth"]}).forEach(function(child) {
                nodeCoords(child);
            });
        } else {
            nodeSizes.push(tipSize);
            colors.push(nodeColor(mapping[tree["name"]]));
        }
    }
    
    nodeCoords(tree);
    console.log(colors);
    
    var yMin = Math.min(...y);
    var yMax = Math.max(...y);
    var d = 1;
    
    function treeCordToRadial(coord) {
        var x = coord[0];
        var y = coord[1];
        
        if (x === null || y === null) {
            return [null, null]
        }
        
        var r = x;
        var theta = 2*Math.PI*(y-yMin+d)/(yMax-yMin+d);
        
        return [r, theta]
    }
    
    function polorCoordToCartestian(polarCoord) {
        var r = polarCoord[0];
        var theta = polarCoord[1];
        
        if (r == null || theta == null) {
            return [null, null]
        }
        return [Math.cos(theta)*r, Math.sin(theta)*r]
    }
    
    if (radial) {
        x = [];
        y = [];
        colors = [];
        nodeSizes = [];
        function convertRadial(tree) {
            var radialCoords = treeCordToRadial([tree["x"], tree["y"]]);
            var coords = polorCoordToCartestian(radialCoords);
            tree["r"] = radialCoords[0];
            tree["theta"] = radialCoords[1];
            tree["x"] = coords[0];
            tree["y"] = coords[1];
            x.push(coords[0]);
            y.push(coords[1]);
            if (!isTip(tree)) {
                nodeSizes.push(internalNodeSize);
                colors.push("#a4a4a4")
                tree["branchset"].sort(function(a, b) {return a["depth"] - b["depth"]}).forEach(function(child) {
                    convertRadial(child);
                });
            } else {
                nodeSizes.push(tipSize);
                colors.push(nodeColor(mapping[tree["name"]]));
            }
        }
        
        convertRadial(tree)
    }
    
    
    var xh = [];
    var yh = [];
    var xv = []
    var yv = [];
    
    if (radial) {
        var rh = [];
        var thetah = [];
        var rv = []
        var thetav = [];
        function lines(tree) {
            if (!isTip(tree)) {
                var rStart = tree["r"]
                var theta = tree["theta"]
                
                var childrenRs = [];
                var childrenThetas = [];
                
                tree["branchset"].sort(function(a, b) {return a["theta"] - b["theta"]}).forEach(function(child) {
                    lines(child);
                    childrenRs.push(child["r"]);
                    childrenThetas.push(child["theta"]);
                });
                var rEnd = Math.min(...childrenRs);
                var hlineEnd = (rStart + rEnd)/2;
                
                rh = rh.concat([rStart, hlineEnd, null]) // first part of connection, x
                thetah = thetah.concat([theta, theta, null]) // first part of connection, y
                
                
                // draw the second parts horizontal x
                childrenRs.forEach(function(r) {
                    rh = rh.concat([hlineEnd, r, null]);
                });
                
                // draw the second parts horizontal y
                childrenThetas.forEach(function(theta) {
                    thetah = thetah.concat([theta, theta, null])
                })
                
                // draw the vertical part as a spline
                var maxTheta = Math.max(...childrenThetas);
                var minTheta = Math.min(...childrenThetas);
                var thetaRange = _.range(minTheta, maxTheta, (maxTheta - minTheta)/25)
                childrenThetas.concat([theta]).concat(thetaRange).sort().forEach(function(thetaC) {
                    rv.push(hlineEnd);
                    thetav.push(thetaC);
                })
                
                rv.push(null);
                thetav.push(null);
                
            }
        }
        
        lines(tree)    
        
        var coords = _.unzip(_.zip(rh, thetah).map(polorCoordToCartestian))
        xh = coords[0];
        yh = coords[1];
        coords = _.unzip(_.zip(rv, thetav).map(polorCoordToCartestian))
        xv = coords[0];
        yv = coords[1];
        
    } else {
        function lines(tree) {
            if (!isTip(tree)) {
                var xStart = tree["x"]
                var y = tree["y"]
                
                var childrenXs = [];
                var childrenYs = []
                tree["branchset"].sort(function(a, b) {return a["depth"] - b["depth"]}).forEach(function(child) {
                    lines(child);
                    childrenXs.push(child["x"]);
                    childrenYs.push(child["y"]);
                });
                var xEnd = Math.min(...childrenXs);
                var hlineEnd = (xStart + xEnd)/2;
                xh = xh.concat([xStart, hlineEnd, null]) // first part of connection, x
                yh = yh.concat([y, y, null]) // first part of connection, y
                
                // draw the second parts horizontal x
                childrenXs.forEach(function(x) {
                    xh = xh.concat([hlineEnd, x, null]);
                });
                
                // draw the second parts horizontal y
                childrenYs.forEach(function(y) {
                    yh = yh.concat([y, y, null])
                })
                
                // draw the vertical part
                xv = xv.concat([hlineEnd, hlineEnd, null]);
                yv = yv.concat([Math.min(...childrenYs), Math.max(...childrenYs), null]);
            }
        }
        lines(tree)
    }
    
    var nodesTrace = {
        x: x,
        y: y,
        type: "scattergl",
        text: names,
        mode: "markers",
        marker: {
          color: colors,
          size: nodeSizes,
          opacity: 1
        },
        hoverinfo: "text"
        
    }
    
    var horizontalLines = {
        x: xh,
        y: yh,
        mode: "lines",
        type:"scatter",
        line: {
          color: '#000000',
          width: 0.5,
          shape: "spline"
        },
        hoverinfo: 'skip'
    }
    
    var verticalLines = {
        x: xv,
        y: yv,
        mode: "lines",
        type:"scatter",
        line: {
          color: '#000000',
          width: 0.5,
          shape: "spline"
        },
        hoverinfo: 'skip'
    }
    
    var layout = {
        width: 770,
        height: 770,
        showlegend: false,
        yaxis: {'showgrid':false, 'zeroline':false, "showline":false, showticklabels:false},
        xaxis: {'showgrid':false, 'zeroline':false, "showline":false, showticklabels:false},
        hovermode:"closest"
    }
    
    var data = [horizontalLines, verticalLines, nodesTrace];
    // clear any existing event listeners
    $(div).off();
    Plotly.newPlot(div, data, layout);
    // add event listener for clicks
    div.on('plotly_click', function(eventData) {
        var expansion = selectionExpander(tree, eventData.points.map(x => x["text"]));
        var selectedNames = expansion.selectedNames;
        var cells = expansion.cells;
        
        var nodesToSelect = expansion.nodesToSelect;
        
        var selectedpointsIdx = [];
        names.map(function (name, idx) {
            if (selectedNames.includes(name)) {
                selectedpointsIdx.push(idx);
            }
        });
      
        data[2].selectedpoints =  selectedpointsIdx;
        
        Plotly.react(div, data, layout);
        
        set_global_status({"selected_cell":cells, "selection_type":"cells"});
    });
    
    // add event listener for selection
    div.on('plotly_selected', function(eventData) {
        if (eventData === undefined) {
            set_global_status({"selected_cell":[], "selection_type":"none"});
            return;
        }
        // event data are points, internal and tips
        // for each tip use joining algo to find the internal nodes that lead to it
        // for each internal node find the tips and restyle so they're selected
        // restyle the lines so that they're highlight colored
        var expansion = selectionExpander(tree, eventData.points.map(x => x["text"]));
        var selectedNames = expansion.selectedNames;
        var cells = expansion.cells;
        
        var nodesToSelect = expansion.nodesToSelect;
        
        var selectedpointsIdx = [];
        names.map(function (name, idx) {
            if (selectedNames.includes(name)) {
                selectedpointsIdx.push(idx);
            }
        });
      
        data[2].selectedpoints =  selectedpointsIdx;
        
        Plotly.react(div, data, layout);
        
        set_global_status({"selected_cell":cells, "selection_type":"cells"});
        
    })
    return({"tree": tree, "data": data, "layout": layout})
}


function updateDendroSelection(div, tree, data, layout, cells) {
    var expansion = selectionExpander(tree, cells);
    var selectedNames = expansion.selectedNames;
    
    var names = data[2].text;
    var selectedpointsIdx = [];
    names.map(function (name, idx) {
        if (selectedNames.includes(name)) {
            selectedpointsIdx.push(idx);
        }
    });
    if (selectedpointsIdx.length > 0) {
        data[2].selectedpoints =  selectedpointsIdx;
    } else {
        data[2].selectedpoints =  null;
    }
    
    
    Plotly.react(div, data, layout);
    
}


function selectionExpander(tree, cells) {
    var selectedNames = cells;
    var cells = [];
    
    var nodesToSelect = [];
    function treeSelect(tree, parentSelected) {
        var updateSelected = parentSelected && !selectedNames.includes(tree["name"]);
        tree["selected"] = parentSelected || selectedNames.includes(tree["name"]);
        if (!isTip(tree)) {
            var childrenSelects = [];
            tree["branchset"].forEach(function(child) {
                treeSelect(child, tree["selected"]);
                childrenSelects.push(child["selected"]);
            });
            
            updateSelected = updateSelected || (!tree["selected"] && childrenSelects.every(x => x));
            tree["selected"] = tree["selected"] || childrenSelects.every(x => x);
        } else {
            if (tree["selected"]) {
                cells.push(tree["name"]);
            }
        }
        
        if (updateSelected) {
            selectedNames.push(tree["name"]);
            nodesToSelect.push(tree["name"]);
        }
    }
    
    treeSelect(tree, false);
    return({"cells":cells, "selectedNames":selectedNames, "nodesToSelect":nodesToSelect})
}
