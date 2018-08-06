window.com_byteowls_vaadin_chartjs_ChartJs = function () {
    // see the javadoc of com.vaadin.ui.
    // for all functions on this.
    var e = this.getElement();
    // Please note that in JavaScript, this is not necessarily defined inside callback functions and it might therefore be necessary to assign the reference to a separate variable
    var self = this;
    var loggingEnabled = false;
    var canvas;
    var chartjs;
    var stateChangedCnt = 0;

    // called every time the state is changed
    this.onStateChange = function () {
        stateChangedCnt++;
        var state = this.getState();
        loggingEnabled = state.loggingEnabled;
        if (loggingEnabled) {
            console.log("chartjs: accessing onStateChange the " + stateChangedCnt + ". time");
        }
        if (typeof canvas === 'undefined') {
            if (loggingEnabled) {
                console.log("chartjs: create canvas");
            }
            canvas = document.createElement('canvas');
            if (state.width && state.width.length > 0) {
                if (loggingEnabled) {
                    console.log("chartjs: canvas width " + state.width);
                }
                canvas.setAttribute('width', state.width);
            }
            if (state.height && state.height.length > 0) {
                if (loggingEnabled) {
                    console.log("chartjs: canvas height " + state.height);
                }
                canvas.setAttribute('height', state.height);
            }
            e.appendChild(canvas)
        } else {
            if (loggingEnabled) {
                console.log("chartjs: canvas already exists");
            }
        }

        if (typeof chartjs === 'undefined' && state.configurationJson !== 'undefined') {
            if (loggingEnabled) {
                console.log("chartjs: init");
            }

            if (loggingEnabled) {
                console.log("chartjs: configuration is\n", JSON.stringify(state.configurationJson, null, 2));
            }
            chartjs = new Chart(canvas, state.configurationJson);
            // #69 the zoom/plugin captures the wheel event so no vertical scrolling is enabled if mouse is on
            if (state.configurationJson && !state.configurationJson.options.zoom) {
                chartjs.ctx.canvas.removeEventListener('wheel', chartjs.zoom._wheelHandler);
            }
            // only enable if there is a listener
            this.updateDataPointClickCallback(state);
            this.updateLegendClickCallback(state);
            this.updateHiddenSlicesForPieChart();

            if (state.configurationJson.options.numberFormatEnabled) {
                this.formatNumbers();
                chartjs.update();
            }
        } else {
            // update the data
            chartjs.resize();
            chartjs.config.data = state.configurationJson.data;
            // update config: options must be copied separately, just copying the "options" object does not work
            chartjs.config.options.legend = state.configurationJson.options.legend;
            chartjs.config.options.scales = state.configurationJson.options.scales;
            chartjs.config.options.annotation = state.configurationJson.options.annotation;
            //also update click listeners, otherwise a change of the state on the server might lead to missing listeners
            this.updateDataPointClickCallback(state);
            this.updateLegendClickCallback(state);

            if (state.configurationJson.options.numberFormatEnabled) {
                this.formatNumbers();
            }

            chartjs.update();

            //must do this after update, else no meta data available
            this.updateHiddenSlicesForPieChart();
        }

    };

    this.formatNumbers = function () {

        var type = chartjs.config.type;

        //format y scales
        if (chartjs.config.options.scales) {
            chartjs.config.options.scales.yAxes.forEach(function (yAxis) {
                yAxis.ticks.callback = function (value) {
                    return value.toLocaleString();
                }
            });
        }
        //format tooltips
        if (chartjs.config.options.tooltips) {
            chartjs.config.options.tooltips.callbacks.label = function (tooltipItem, data) {
                if (type === "pie") {
                    return data.labels[tooltipItem.index] + ": " + data.datasets[0].data[tooltipItem.index].toLocaleString();
                } else {
                    return data.datasets[tooltipItem.datasetIndex].label + ": " + tooltipItem.yLabel.toLocaleString();
                }
            };
        }
    };

    this.updateLegendClickCallback = function (state) {
        if (state.legendClickListenerFound) {
            if (loggingEnabled) {
                console.log("chartjs: add legend click callback");
            }
            if(chartjs.config.type !== "pie") {
                chartjs.legend.options.onClick = chartjs.options.legend.onClick = function (t, e) {
                    var datasets = this.chart.data.datasets;
                    var dataset = datasets[e.datasetIndex];
                    dataset.hidden = !dataset.hidden;
                    this.chart.update();
                    var ret = [];
                    for (var i = 0; i < datasets.length; i++) {
                        if (!datasets[i].hidden) {
                            ret.push(i);
                        }
                    }
                    self.onLegendClick(e.datasetIndex, !dataset.hidden, ret);
                }
            } else {
                //Pie chart with single data has different hide behaviour.
                chartjs.legend.options.onClick = chartjs.options.legend.onClick = function (event, clickedData) {

                    var visibles = [];
                    if(this.chart.data.datasets.length < 1){
                        return;
                    }
                    var pieDataSet = this.chart.data.datasets[0];
                    if(pieDataSet._meta){
                        for (var property in pieDataSet._meta) {
                            if (pieDataSet._meta.hasOwnProperty(property)) {
                                var metaDataArray = pieDataSet._meta[property].data;
                                metaDataArray.forEach(function (data, index) {
                                    if (clickedData.index === index) {
                                        data.hidden = !data.hidden;
                                    }
                                    if (!data.hidden) {
                                        visibles.push(index);
                                    }
                                });
                            }
                        }
                    }
                    this.chart.update();
                    self.onLegendClick(clickedData.index, clickedData.hidden, visibles);
                }
            }
        }
    };

    this.updateDataPointClickCallback = function (state) {
        if (state.dataPointClickListenerFound) {
            if (loggingEnabled) {
                console.log("chartjs: add data point click callback");
            }
            canvas.onclick = function(e) {
                var elementArr = chartjs.getElementAtEvent(e);
                if (elementArr && elementArr.length > 0) {
                    var element = elementArr[0];
                    if (loggingEnabled) {
                        console.log("chartjs: onclick elements at:");
                        console.log(element);
                    }
                    // call on function registered by server side component
                    self.onDataPointClick(element._datasetIndex, element._index);
                }
            };
        }
    };

    this.updateHiddenSlicesForPieChart = function (){
        //must do this after update, else no meta data available
        if(chartjs.config.type === "pie") {
            if(chartjs.chart.data.datasets.length < 1){
                return;
            }
            var pieDataSet = chartjs.chart.data.datasets[0];
            if(pieDataSet._meta) {
                for (var property in pieDataSet._meta){
                    if(pieDataSet._meta.hasOwnProperty(property)) {
                        var metaDataArray = pieDataSet._meta[property].data;
                        if(metaDataArray) {
                            metaDataArray.forEach(function (data, index) {
                                if (pieDataSet.hiddenSlices.indexOf(index) > -1) {
                                    data.hidden = true;
                                }
                            });
                        }
                    }
                }
                chartjs.update();
            }
        }
    };

    this.getImageDataUrl = function (type, quality) {
        if (typeof quality !== 'undefined') {
            console.log("chartjs: download image quality: " + quality);
        }
        // TODO create issue on chart.js to allow jpeg downloads
        // call on function registered by server side component
        self.sendImageDataUrl(chartjs.toBase64Image());
    };

    this.destroyChart = function () {
        if (chartjs) {
            chartjs.destroy();
        }
    }

};
