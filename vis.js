const width = window.innerWidth,
    height = window.innerHeight,
    maxRadius = Math.min(width, height) / 2 - 5;

const formatNumber = d3.format(',d');

const x = d3.scaleLinear()
    .range([0, 2 * Math.PI])
    .clamp(true);

const y = d3.scaleSqrt().range([maxRadius * 0.1, maxRadius]);

// sunlight style guide network colors
// https://github.com/amycesal/dataviz-style-guide/blob/master/Sunlight-StyleGuide-DataViz.pdf
const dark = [
    '#B08B12',
    '#BA5F06',
    '#8C3B00',
    '#6D191B',
    '#842854',
    '#5F7186',
    '#193556',
    '#137B80',
    '#144847',
    '#254E00'
];

const mid = [
    '#E3BA22',
    '#E58429',
    '#BD2D28',
    '#D15A86',
    '#8E6C8A',
    '#6B99A1',
    '#42A5B3',
    '#0F8C79',
    '#6BBBA1',
    '#5C8100'
];

const light = [
    '#F2DA57',
    '#F6B656',
    '#E25A42',
    '#DCBDCF',
    '#B396AD',
    '#B0CBDB',
    '#33B6D0',
    '#7ABFCC',
    '#C8D7A1',
    '#A0B700'
];

const palettes = [light, mid, dark];
const lightGreenFirstPalette = palettes
    .map(d => d.reverse())
    .reduce((a, b) => a.concat(b));

//颜色生成器
const color = d3.scaleOrdinal(lightGreenFirstPalette);

const color2 = d3.scaleLinear()
    .domain([0,4000])
    .range(["#6eeb34","#eb3434","#eb9934","#eb3434"])

//为了后面把层次数据递归的生成旭日图或饼状图
const partition = d3.partition();

// 定义一个弧生成器
    /*
        x0:圆环开始角度
        x1:圆环结束角度
        y0:圆环内半径
        y1:圆环外半径
     */
const arc = d3
    .arc()
    .startAngle(d => x(d.x0))
    .endAngle(d => x(d.x1))
    .innerRadius(d => Math.max(0, y(d.y0)))
    .outerRadius(d => Math.max(0, y(d.y1)));

const middleArcLine = d => {
    const halfPi = Math.PI / 2;
    const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

    const middleAngle = (angles[1] + angles[0]) / 2;
    const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
    if (invertDirection) {
        angles.reverse();
    }

    const path = d3.path();
    path.arc(0, 0, r, angles[0], angles[1], invertDirection);
    return path.toString();
};

const textFits = d => {
    const CHAR_SPACE = 6;

    const deltaAngle = x(d.x1) - x(d.x0);
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);
    const perimeter = r * deltaAngle;

    return d.data.name.length * CHAR_SPACE < perimeter;
};

const svg = d3
    .select('body')
    .append('svg')
    .style('width', '100vw')
    .style('height', '100vh')
    .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
    .on('click', () => focusOn()); // Reset zoom on canvas click

d3.json(
    'flare.json',
    (error, root) => {
        if (error) throw error;

        root = d3.hierarchy(root); //从分层数据构造一个根节点，方便下面布局函数调用
        console.log(root)
        root.sum(d => d.size);  //依次生成所有后代节点的数组

        const slice = svg.selectAll('g.slice').data(partition(root).descendants()); //生成后代数组然后绑定到属性为slice的g上
        console.log(partition(root).descendants())

        slice.exit().remove(); //清除工作

        const newSlice = slice
            .enter()
            .append('g')
            .attr('class', 'slice')
            .on('click', d => {
                d3.event.stopPropagation();//阻止点击事件的传播
                focusOn(d); //每一块都执行这个事件
            });

        newSlice
            .append('title')
            .text(d => d.data.name + '\n' + formatNumber(d.value)+'\n'); //鼠标悬停在上面时，显示的文字

        newSlice
            .append('path')
            .attr('class', 'main-arc')
            // .style('fill', d => color((d.children ? d.data.name : day_color(d)))) //每一块的颜色，我们最后一层的颜色，是随着时间的变化，随着值的不同，而不同的
            .style("fill",d => d.children?color(d.data.name):color2(d.value))
            //这个地方一定要选，而不是说，最后一层就跟前面一层颜色相同了
            .attr('d', arc);

        function day_color(d){
            //根据每个d值的不同而呈现不一样的颜色，做一个颜色变化范围的插值器就行了
            var value = d.value,
                tag = "";
            if(value<1000)
                tag =  "china";
            else if(value > 1000 && value < 3000)
                tag = "wuhan";
            else
                tag = "ll";
            return tag;
        }

        newSlice
            .append('path') //跟下面那个结合绘制文字
            .attr('class', 'hidden-arc')
            .attr('id', (_, i) => `hiddenArc${i}`)
            .attr('d', middleArcLine);

        const text = newSlice
            .append('text') //写入文字
            .attr('display', d => (textFits(d) ? null : 'none'));

        // 为文字增加白色轮廓
        text
            .append('textPath')
            .attr('startOffset', '50%')
            .attr('xlink:href', (_, i) => `#hiddenArc${i}`) //
            .text(d => d.data.name)
            .style('fill', 'none')
            .style('stroke', '#E5E2E0')
            .style('stroke-width', 12)
            .style('stroke-linejoin', 'round');

        text
            .append('textPath')
            .attr('startOffset', '50%')
            .attr('xlink:href', (_, i) => `#hiddenArc${i}`)
            .text(d => d.data.name);
    }
);

function focusOn(d) {
    // 如果未指定数据点，则重置为顶级

    const transition = svg
        .transition()
        .duration(750)
        .tween('scale', () => {
            const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                yd = d3.interpolate(y.domain(), [d.y0, 1]);
            return t => {
                x.domain(xd(t));
                y.domain(yd(t));
            };
        });

    transition.selectAll('path.main-arc').attrTween('d', d => () => arc(d));

    transition
        .selectAll('path.hidden-arc')
        .attrTween('d', d => () => middleArcLine(d));

    transition
        .selectAll('text')
        .attrTween('display', d => () => (textFits(d) ? null : 'none'));

    moveStackToFront(d);

    //指定外围圆圈
    if(d.depth == 2){
        var circle = svg.append("g")
            .attr("id",'circle')
            .append("circle")
            .attr("r",maxRadius)
            .attr("fill","none")
            .attr("stroke","black")
            .attr("stroke-width",2)
    }else
        d3.select('#circle').remove();




    //移动到前面显示的方法
    function moveStackToFront(elD) {
        svg
            .selectAll('.slice')
            .filter(d => d === elD)
            .each(function(d) {
                this.parentNode.appendChild(this);
                if (d.parent) {
                    moveStackToFront(d.parent);
                }
            });
    }
}
