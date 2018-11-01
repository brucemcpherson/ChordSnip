/**
* creates a chord chart in the sidebar 
* monitors for data changes and replots if there are any
* details at http://ramblings.mcpher.com/Home/excelquirks/addons/sankeyaddon
*/
var Chord = (function(ns) {
  'use strict';
  
  /**
  * draw a chord
  * @param {object} sets the chart settings
  * @param {string[]} headers
  * @param {[[string,string,number]]} data
  * @param {element} chartElem where to put it
  * @param {boolean} clear whether to clear current chart.
  */
  
  
  ns.drawChart = function (sets,headers, data, chartElem,clear) {
    
    // clone the settings
    var settings = Utils.clone (sets);
    
    if(clear) {
      chartElem.innerHTML = "";
    }
    
    // this might fail since we could pick up the data at any point - but that's ok
    try {
      
      // dont let the from and to field be the same
      if (headers[0] === headers[1]) return;
      
      
      // filter out incomplete or crap data
      var clean = data.map(function(d){
        return [d[0],d[1],parseFloat (d[2])];
      })
      .filter (function(d) {
        return d[0] && d[1] && !isNaN(d[2]) && d[2] >=0;
      });

      
      // need to make a unique list of the participants
      var participants = clean.reduce(function (p,c) {
        
        [c[0],c[1]].forEach(function(d) {
          if (p.indexOf(d) === -1) {
            p.push (d);
          }
        });
        return p;
      },[]);
      
      
      // now the matrix for a chord is an array participants x participants
      var matrix = participants.map (function (from) {
        return participants.map(function(to) {
          return clean.reduce(function(p,c) {
            if (c[0]===from && c[1]===to) {
              p += c[2]; 
            }
            return p;
          },0);
        });
      });
      
      // now its time to do the d3 chart
      doChordChart_ (participants , matrix, settings,chartElem);
    }
    catch (err) {
      // no need -  probably just means the line is not complete yet
      console.log(err);
    }
  };
  
  /**
  * do the chord chart
  * @param {[string]} participants a list of items to include
  * @param {[[]]} matrix the values representing the flow between participats
  * @param {object} settings the settings to use
  * @param {DomElement} chartElem the chart element to use
  */
  function doChordChart_(participants, matrix, settings, chartElem) {
   
    // set up dimensions
    var width = settings.width,
        height = width,
        outerRadius = Math.min(width, height) / 2,
          innerRadius = outerRadius - settings.sankey.node.width;
    

    var formatValue = d3.formatPrefix(",.0", 1e3);
    
    // create the svg element for the diagram
    var svg = d3.select('#' + chartElem.id).append("svg")
    .attr("width", width)
    .attr("height", height)
    
    // create the chords
    var chord = d3.chord()
    .padAngle(settings.sankey.node.nodePadding);
    
    
    // do any sorting
    if (settings.sankey.node.sortGroups === "descending") {
      chord.sortGroups(d3.descending);
    }
    else if (settings.sankey.node.sortGroups === "ascending") {
      chord.sortGroups(d3.ascending);
    }
    // and the arcs
    var arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);
    
    var ribbon = d3.ribbon()
    .radius(innerRadius);
    
    // assign data to svg groups
    var g = svg.append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
    .datum(chord(matrix));
    
    var group = g.append("g")
    .attr("class", "groups")
    .selectAll("g")
    .data(function(chords) {
      return chords.groups;
    })
    .enter().append("g");
    
    // set up a color scheme for the chords
    if(settings.sankey.link.colorMode.slice(0,4) === "ramp") {
      
      // min & max values
      var extent = settings.sankey.link.colorMode === "rampValue" ? d3.extent (group.data() , function (d) {
        return d.value;
      }) : [0, participants.length];

      var colorInterpolater = d3.scaleLinear()
        .domain([extent[0], extent[1]])
        .interpolate(d3.interpolateHsl)
        .range([settings.sankey.link.color.fill, settings.sankey.link.color.fillEnd]);
      
      var color = function (participant) {
        // this will be a color interpolation
        var iof = participants.indexOf(participant);
        return colorInterpolater (settings.sankey.link.colorMode === "rampValue" ? group.data()[iof].value : iof);
      }

    }
    else {
      if(Process.control.chord.palettes[settings.sankey.link.colorMode]) {
        var color = d3.scaleOrdinal (Process.control.chord.palettes[settings.sankey.link.colorMode]);
      }
      else {
        var color = d3.scaleOrdinal (d3[settings.sankey.link.colorMode]);
      }
      color.domain(participants);
    }
    
    
    
    // generate the paths and assign colors
    var path = group.append("path")
    .style("fill", function(d) {
      return color(participants[d.index]);
    })
    .style("stroke", function(d) {
      return d3.hsl(color(participants[d.index])).darker();
    })
    .attr("d", arc)
    .attr("id", function(d, i) {
      return "group" + d.index;
    })
    .style("opacity", Math.min(settings.sankey.link.color.fillOpacity*1.1,1))
    .style("stroke-width", settings.sankey.link.color.strokeWidth);
    
    // Add a text label.
    var groupText = group.append("text")
    .attr("dy", (outerRadius - innerRadius) / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("x", settings.sankey.node.labelPadding)
    .style("font-size",settings.sankey.node.label.fontSize)
    .style("font-family",settings.sankey.node.label.fontName)
    .style("font-weight",settings.sankey.node.label.bold ? "bold" : "normal")
    .style("font-style",settings.sankey.node.label.italic ? "italic" : "normal")
    .style("fill",settings.sankey.node.label.color);
    
    // add the text to the path
    var groupTextPath = groupText
    .append("textPath")
    .attr("xlink:href", function(d) {
      return "#group" + d.index;
    })
    .attr("startOffset", function(d) {
      // this complexity is to center the text
      var length = path.nodes()[d.index].getTotalLength();
      return (25 - (50 * outerRadius) / length + (50 * innerRadius) / length) + "%";
    })
    .text(function(d) {
      return participants[d.index];
    });
    

    
    //assign data to ribbons
    var ribbons = g.append("g")
    .attr("class", "ribbons")
    .selectAll("path")
    .data(function(chords) {
      return chords;
    });
    
    var ribbonsEnter = ribbons.enter().append("path")
    .attr("d", ribbon)
    .style("fill", function(d) {
      return color(participants[d.target.index]);
    })
    .style("stroke", function(d) {
      return d3.hsl(color(participants[d.target.index])).darker();
    })
    .style("opacity", settings.sankey.link.color.fillOpacity)
    .style("stroke-width", settings.sankey.link.color.strokeWidth);
    
    // Add a mouseover title.
    group.append("title").text(function(d, i) {
      return participants[i] + ": " + d.value;
    })

    
    // add hiding mouseovers 
    group
    .on("mouseover", function(d) {
      ribbonsEnter.classed("mui--hide", function(p) {
        return p.source.index !== d.index && p.target.index !== d.index;
      });
    })
    .on("mouseout", function(d) {
      ribbonsEnter.classed("mui--hide", function(p) {
        return false;
      });
    });
    
    
    // chord mouseover text
    ribbonsEnter.append("title").text(function(d) {
      return participants[d.source.index]
      + " > " + participants[d.target.index] + ' (' + d.source.value + ')' ;
    });

    
  }
  
  ns.doElementer = function (setup) {
    
    return new Elementer()
    .setMain('')
    .setContainer('elementer-content')
    .setRoot('elementer-root')
    .setLayout(setup.layout)
    .setDetail(setup.detail)
    .build();
    
  };
  
  
  ns.mapSettings = function (arger) {
    
    var ec = arger.getElements().controls;
    
    return {
      width: parseInt(ec.previewWidth.value, 10),
      scale: {
        width: parseFloat(ec.scaleWidth.value),
        font: parseFloat(ec.scaleFont.value),
        margin:parseFloat(ec.scaleMargin.value),
        fill:ec.scaleFill.value,
        transparent:ec.scaleFillTransparent.checked
      },
      options:{
        width:parseInt(ec.previewWidth.value, 10),
        
  
        
        sankey: {
          link: {
            colorMode:ec.linkColorMode.value,
            color: {
              fill: ec.linkFillColor.value, // Color of the link.
              fillEnd: ec.linkFillEndColor.value, // color of the end of a ramp
              fillOpacity: parseFloat(ec.linkOpacity.value), // Transparency of the link.
              strokeWidth: parseInt(ec.linkBorderWidth.value, 10) // Thickness of the link border 
            }
          },
          
          node: {
            label: {
              fontName: ec.labelFontName.value,
              fontSize: parseInt(ec.labelFontSize.value, 10),
              color: ec.labelFontColor.value,
              bold: ec.labelFontBold.checked,
              italic: ec.labelFontItalic.checked
            },
            labelPadding: parseInt(ec.labelPadding.value, 10), // Horizontal distance between the lab
            nodePadding: parseFloat(ec.nodePadding.value), // Vertical distance between nodes.
            width: parseInt(ec.nodeWidth.value, 10), // Thickness of the node.
            sortGroups:ec.sortGroups.value  // any sorting
          }
        }
      }
    };
    
    
    
  };
  
  ns.setup = function() {
    return {
      detail: {
        sourceDivider: {
          template: "dividerTemplate",
          label: "Source data"
        },
        filterDivider: {
          template: "dividerTemplate",
          label: "Filtering"
        },
        columnDivider: {
          template: "dividerTemplate",
          label: "Columns"
        },
        
        embedDivider: {
          template: "dividerTemplate",
          label:"Image embed code"
        },
        
        manageDivider: {
          template: "dividerTemplate",
          label:"Manage settings"
        },
        
        useStandard: {
          template: "radioTemplate",
          label: "Standard",
          icon: "tuner",
          properties:{
            name:"use-group"
          },
          values:{
            resetable:false
          }
        },
        useDocument: {
          template: "radioTemplate",
          label: "This document's settings",
          icon: "playlist_play",
          properties:{
            name:"use-group"
          },
          values:{
            resetable:false
          }
        },
        useUser: {
          template: "radioTemplate",
          label: "My personal settings",
          icon: "fingerprint",
          properties:{
            name:"use-group"
          },
          values:{
            resetable:false
          }
        },
        
        useInitial: {
          template: "radioTemplate",
          label: "Reset to initial",
          icon: "undo",
          properties:{
            name:"use-group"
          },
          values:{
            value:true,
            resetable:false
          }
        },
        
        makePermanent: {
          template: "radioTemplate",
          label: "Save for future use in this document",
          icon: "playlist_add_check",
          properties:{
            name:"manage-group"
          },
          values:{
            resetable:false,
            value:true
          }
        },
        
        makeDefault: {
          template: "radioTemplate",
          label: "Save for future use in all my documents",
          icon: "playlist_add",
          properties:{
            name:"manage-group"
          },
          values:{
            resetable:false
          }
        },
        
        clearPermanent: {
          template: "radioTemplate",
          label: "Clear saved settings in this document",
          icon: "settings_backup_restore",
          properties:{
            name:"manage-group"
          },
          values:{
            resetable:false
          }
        },
        
        clearDefault: {
          template: "radioTemplate",
          label: "Clear all my saved default settings",
          icon: "layers_clear",
          properties:{
            name:"manage-group"
          },
          values:{
            resetable:false
          }
        },
        
        manageButton:{
          template:"buttonTemplate",
          classes: {
            element:"action"
          },
          values:{
            value:"SAVE"
          }
        },
        
        
        resetButton_dataSettings:{
          template:"resetButtonTemplate"
        }, 
        
        
        resetButton_embedCode:{
          template:"resetButtonTemplate",
          custom:{
            cancelOnly:true
          }
        }, 
        
        resetButton_arrangePreview:{
          template:"resetButtonTemplate"
        },
        
        resetButton_links:{
          template:"resetButtonTemplate"
        },
        
        resetButton_nodes:{
          template:"resetButtonTemplate"
        },
        
        
        resetButton_scaleRatio:{
          template:"resetButtonTemplate"
        }, 
        
        applyButton:{
          template:"buttonTemplate",
          classes:{
            element:"action"
          },
          values:{
            value:"APPLY"
          },
        },
        
        wholeSheet: {
          template: "radioTemplate",
          label: "Whole sheet",
          icon: "grid_on",
          values: {
            value: true,
            resetable:true
          },
          properties:{
            name:"range-group"
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_dataSettings.disabled = false;
            }
          }
        },
        
        selectedRange: {
          template: "radioTemplate",
          label: "Selected range",
          icon: "domain",
          properties:{
            name:"range-group"
          },
          values:{
            resetable:true
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_dataSettings.disabled = false;
            }
          }
        },
        
        fromColumn: {
          template: "selectTemplate",
          label: "Source column",
          icon: "skip_previous",
          values:{
            resetable:true
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_dataSettings.disabled = false;
            }
          }
        },
        
        toColumn: {
          template: "selectTemplate",
          label: "Target column",
          icon: "skip_next",
          values:{
            resetable:true
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_dataSettings.disabled = false;
            }
          }
        },
        
        weightColumn: {
          template: "selectTemplate",
          label: "Weight column",
          icon: "network_check",
          values:{
            resetable:true
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_dataSettings.disabled = false;
            }
          }
        },
        
        applyFilters: {
          template: "checkboxTemplate",
          label: "Respect filters in data",
          icon: "filter_list",
          values:{
            resetable:true
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_dataSettings.disabled = false;
            }
          }
        },

        
        previewWidth: {
          template: "numberTemplate",
          label: "Diameter",
          icon: "remove_circle_outline",
          properties:{
            max:600
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_arrangePreview.disabled = false;
            }
          }
          
        },
        
        scaleWidth: {
          template: "numberTemplate",
          label: "Width of embedded chart",
          icon: "picture_in_picture_alt",
          properties: {
            max: 1200,
            min: 60,
            step: 1
          },
          values:{
            value:512
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_scaleRatio.disabled = false;
            }
          }
        },
        scaleFont: {
          template: "numberTemplate",
          label: "Font size of embedded chart",
          icon: "format_size",
          properties: {
            max: 32,
            min: 6,
            step: 1
          },
          values:{
            value:14
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_scaleRatio.disabled = false;
            }
          }
        },
        scaleMargin: {
          template: "numberTemplate",
          label: "Image margin",
          icon: "keyboard_tab",
          properties: {
            max: 200,
            min: 0,
            step: 1
          },
          values:{
            value:30
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_scaleRatio.disabled = false;
            }
          }
        },  
        scaleFillTransparent: {
          template: "checkboxTemplate",
          label: "Transparent image frame",
          values:{
            value:false
          },
          icon: "select_all",
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_scaleRatio.disabled = false;
            }
          }
        },
        scaleFill: {
          template: "textTemplate",
          label: "Image frame fill color",
          icon: "format_color_fill",
          properties: {
            type: "color",
            value: '#FFFFFF'
          },
          values:{
            value:'#FFFFFF'
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_scaleRatio.disabled = false;
            }
          }
        },
       sortGroups: {
          template: "selectTemplate",
          label: "Sort diagram",
          icon: "rotate_right",
          options:["none","ascending","descending"],
          values:{
            value:"none"
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        
        nodePadding: {
          template: "numberTemplate",
          label: "Pad angle between nodes",
          icon: "filter_tilt_shift",
          properties: {
            max: 0.2,
            min: 0,
            step:0.01
          },
          values:{
            value:.05
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        nodeWidth: {
          template: "numberTemplate",
          label: "Thickness of arc",
          icon: "donut_large",
          properties: {
            max: 50,
            min: 0
          },
          values:{
            value:20
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },

        linkColorMode:{
          template:"selectTemplate",
          label:"Color mode",
          icon:"gradient",
          options:["google20","schemeCategory10","schemeCategory20","schemeCategory20b","schemeCategory20c","rampPosition","rampValue"],
          values:{
            value:"google20"
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_links.disabled = false;
            }
          }
        },
        linkFillColor: {
          template: "textTemplate",
          label: "Color ramp start",
          icon: "invert_colors",
          properties: {
            type: "color",
            value: '#3F51B5'
          },
          values:{
            value:'#3F51B5'
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_links.disabled = false;
            }
          }
        },
        linkFillEndColor: {
          template: "textTemplate",
          label: "Color ramp end",
          icon: "invert_colors_off",
          properties: {
            type: "color",
            value: '#FF5722'
          },
          values:{
            value:'#FF5722'
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_links.disabled = false;
            }
          }
        },
        linkBorderWidth: {
          template: "numberTemplate",
          label: "Border width",
          icon: "line_weight",
          properties: {
            max: 5,
            min: 0
          },
          values:{
            value:1
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_links.disabled = false;
            }
          }
        },

        linkOpacity: {
          template: "numberTemplate",
          label: "Opacity",
          icon: "opacity",
          properties: {
            min: 0,
            max: 1,
            step: 0.1
          },
          values:{
            value:0.3
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_links.disabled = false;
            }
          }
        },
        labelDivider: {
          template: "dividerTemplate",
          label: "Labels"
        },
        labelPadding: {
          template: "numberTemplate",
          label: "Label padding",
          icon: "format_indent_increase",
          properties: {
            max: 20,
            min: 0,
            value: 3
          },
          values:{
            value:3
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        labelFontSize: {
          template: "numberTemplate",
          label: "Font size",
          icon: "format_size",
          properties: {
            min: 4,
            max: 20
          },
          values:{
            value:10
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        labelFontName: {
          template: "textTemplate",
          label: "Font name",
          icon: "text_fields",
          values: {
            value: "Roboto"
          },
          styles:{
            element:"width:80px;"
          }
        },
        labelFontColor: {
          template: "textTemplate",
          label: "Font color",
          icon: "format_color_text",
          properties: {
            type: "color"
          },
          values:{
            value:'#212121'
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        labelFontBold: {
          template: "checkboxTemplate",
          label: "Bold",
          values:{
            value:false
          },
          icon: "format_bold",
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        labelFontItalic: {
          template: "checkboxTemplate",
          label: "Italic",
          icon: "format_italic",
          values:{
            value:false
          },
          on: {
            change: function (elementer, branch , ob,e) {
              elementer.getElements().controls.resetButton_nodes.disabled = false;
            }
          }
        },
        svgLabel: {
          template:"contentTemplate",
          label: "Copy embeddable SVG code below",
          styles:{
            tdLabel:"border-width:0px;"
          }
        },
        
        svgCode: {
          template: "textAreaTemplate",
          label: "",
          properties: {
            disabled: true,
            rows: 16,
            spellcheck: false
          },
          classes:{
            elementContainer:"mui--text-dark-hint",
          },
          values:{
            resetable:false
          }
        },
        
        chartDivider:{
          label:"Chart settings",
          template:"dividerTemplate"
        },
        
        dataDivider:{
          label:"Source data settings",
          template:"dividerTemplate"
        },
      },
      layout: {
        settings: {
          prefix: "layout",
          root: "root"
        },
        pages: {
          root: {
            label: "Settings menu",
            items: ["chartDivider", "arrangePreview", "scaleRatio","saveSettings","manageSettings","dataDivider","dataSettings","embedDivider","embedCode"]
          },
          
          dataSettings: {
            label: "Data",
            items: ["sourceDivider", "wholeSheet", "selectedRange", "columnDivider", 
                    "fromColumn", "toColumn", "weightColumn","filterDivider", "applyFilters","resetButton_dataSettings"],
            on:{
              enter:function (elementer,branch) {
                elementer.getElements().controls.resetButton_dataSettings.disabled = true;
                Process.reserveResetValues (elementer, branch);
              },
              exit:function (elementer, branch) {
                Process.restoreResetValues (Process.control.chord.elementer , branch);
              }
            }
          },
          
          
          manageSettings: {
            label:"Reset",
            items:["useInitial","useStandard","useUser", "useDocument","applyButton"],
            on: {
              exit: function (elementer, branch) {
                // reset the buttons to apply next time in
                Process.control.buttons.apply.disabled=false;
              }
            }
          },
          
          saveSettings: {
            label:"Save",
            items:["makePermanent","makeDefault","clearPermanent","clearDefault","manageButton"],
            on: {
              exit: function (elementer, branch) {
                // reset the buttons to apply next time in
                Process.control.buttons.manage.disabled=false;
              }
            }
          },
          
          embedCode: {
            label: "Get",
            items: ["svgLabel","svgCode","resetButton_embedCode"]
          },
          
          arrangePreview: {
            label: "Appearance",
            items: [ "previewWidth", "links", "nodes","resetButton_arrangePreview"],
            on:{
              enter:function (elementer,branch) {
                elementer.getElements().controls.resetButton_arrangePreview.disabled = true;
                Process.reserveResetValues (elementer, branch);
              },
              exit:function (elementer, branch) {
                Process.restoreResetValues (Process.control.chord.elementer , branch);
              }
            }
          },
          
          scaleRatio: {
            label: "Scale",
            items: ["scaleWidth", "scaleFont","scaleMargin","scaleFill","scaleFillTransparent","resetButton_scaleRatio"],
            on:{
              enter:function (elementer,branch) {
                elementer.getElements().controls.resetButton_scaleRatio.disabled = true;
                Process.reserveResetValues (elementer, branch);
              },
              exit:function (elementer, branch) {
                Process.restoreResetValues (Process.control.chord.elementer , branch);
              }
            }
          },
          
          links: {
            label: "Links",
            items: ["linkColorMode","linkFillColor", "linkFillEndColor","linkOpacity", "linkBorderWidth","resetButton_links"],
            on:{
              enter:function (elementer,branch) {
                elementer.getElements().controls.resetButton_links.disabled = true;
                Process.reserveResetValues (elementer, branch);
              },
              exit:function (elementer, branch) {
                Process.restoreResetValues (Process.control.chord.elementer , branch);
              }
            }
          },
          
          nodes: {
            label: "Nodes",
            items: ["nodePadding", "nodeWidth", "sortGroups","labelDivider", "labelPadding",  "labelFontSize", 
                    "labelFontColor", "labelFontName","labelFontBold", "labelFontItalic","resetButton_nodes"],
            on:{
              enter:function (elementer,branch) {
                elementer.getElements().controls.resetButton_nodes.disabled = true;
                Process.reserveResetValues (elementer, branch);
              },
              exit:function (elementer, branch) {
                Process.restoreResetValues (Process.control.chord.elementer , branch);
              }
            }
          }
        }
      }
    }
  };
  
  
  
  return ns;
  
})(Chord || {});