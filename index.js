function $$(data) {
  function get(key, value) {
    data = (data || {})[key] || value;
    return get;
  }
  get.value = function() {
    if (Array.isArray(data)) {
      return data;
    }
    let result = Number(data)
    if (!isNaN(result)) {
      return result;
    }
    result = new Date(data);
    if (!isNaN(result.getTime())) {
      return result;
    }

    return data;
  }

  return get;
}

function renderValue(obj, key) {
  const value = obj[key];
  if (typeof value === 'string') {
    if (['color', 'backgroundColor'].indexOf(key) > -1) {
      if (value.indexOf('rgba') === -1) {
        return value;
      }
    }
    if (['border', 'backgroundImage', 'boxShadow'].indexOf(key) > -1 && value.indexOf('colors') > -1) {
      return `\`${value}\``;
    }
    return `\'${value}\'`;
  }
  return value;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function nameToVar(name, separator = '-') {
  return name
    .split(separator)
    .map((part = '', i) => {
      if (i === 0) {
        return part.toLowerCase();
      }
      return capitalizeFirstLetter(part);
    })
    .join('');
}

function toFixed(value, number, force) {
  if (!value && !force) {
    return undefined;
  }
  return Number(value.toFixed(number));
}

function toPx(value) {
  return value === 0 ? value : `${value}px`;
}

function toJSText(name, style) {
  const jsStyle = Object.keys(style)
    .filter((key) => style[key] !== undefined)
    .map((key) => {
      return `  ${key}: ${renderValue(style, key)},`
    }).join('\n');

  return `${name.replace(/[^a-zA-Z]/g, '') || 'layer'}: {
${jsStyle}
},`;
}

function rgba(data) {
  return `rgba(${data.r}, ${data.g}, ${data.b}, ${toFixed(data.a, 2, true)})`;
}

function layer(context, layer) {
  var JSONString = JSON.stringify(layer, null, 2);

  function colorToString(data) {
    const colors = $$(context)('_project')('colors', []).value();

    const color = colors.find((color) =>
    (
      color.r === data.r &&
      color.g === data.g &&
      color.b === data.b &&
      color.a === data.a
    ));

    if (color) {
      let name = nameToVar(color.name);
      return `colors.${name}`;
    }

    return rgba(data);
  }

  const textStyles = $$(layer)('textStyles', []).value();
  const textStyle = $$(textStyles[0] || {})('textStyle', {}).value();
  const textColor = $$(textStyle)('color').value();
  const fills = $$(layer)('fills', []).value();
  const shadows = $$(layer)('shadows', []).value();
  const borders = $$(layer)('borders', []).value();
  const backgrounds = {};
  const shadow = [];
  const border = [];

  fills.forEach((fill) => {
    if (fill.type === 'color') {
      const color = fill.color;
      if (!backgrounds.backgroundColor) {
        backgrounds.backgroundColor = [colorToString(color)];
      }
    }
    if (fill.type === 'gradient') {
      const gradient = fill.gradient;
      if (!backgrounds.backgroundImage) {
        backgrounds.backgroundImage = [];
      }
      if (gradient.type === 'linear') {
        const colors = gradient.colorStops.map((c) => {
          const cc = colorToString(c.color);
          return `${cc.indexOf('rgba') > -1 ? cc: `\$\{${cc}\}` } ${Math.round(c.position * 100)}%`;
        });
        backgrounds.backgroundImage.push(`linear-gradient(${gradient.angle}deg, ${colors.join(', ')})`);
      }
    }
  });

  shadows.forEach((s) => {
    let type = 'inset ';
    if (s.type === 'outer') {
      type = '';
    }
    const color = colorToString(s.color);
    shadow.push(`${type}${toPx(s.offsetX)} ${toPx(s.offsetY)} ${toPx(s.spread)} ${toPx(s.blurRadius)} ${color.indexOf('rgba') > -1 ? color: `\$\{${color}\}`}`)
  });

  borders.forEach((b) => {
    if (border.length) {
      return;
    }
    if (b.fill.type === 'color') {
      const color = colorToString(b.fill.color);
      border.push(`solid ${toPx(b.thickness)} ${color.indexOf('rgba') > -1 ? color: `\$\{${color}\}`}`);
    }
  });

  const style = {
    width: toFixed(layer.rect.width, 1),
    height: toFixed(layer.rect.height, 1),
    fontSize: toFixed($$(textStyle)('fontSize').value(), 1),
    textAlign: $$(textStyle)('textAlign').value(),
    fontFamily: $$(textStyle)('fontFamily').value(),
    fontStyle: $$(textStyle)('fontStyle').value(),
    fontWeight: $$(textStyle)('weightText').value(),
    color: textColor && colorToString(textColor),
    letterSpacing: toFixed($$(textStyle)('letterSpacing').value(), 2),
    borderRadius: layer.borderRadius ? toFixed(layer.borderRadius, 1) : undefined,
    opacity: layer.opacity === 1 ? undefined: toFixed(layer.opacity, 2),
    backgroundColor: backgrounds.backgroundColor && backgrounds.backgroundColor.join(', '),
    backgroundImage: backgrounds.backgroundImage && backgrounds.backgroundImage.join(', '),
    [layer.type === 'text' ? 'textShadow': 'boxShadow']: shadow.length ? shadow.join(', '): undefined,
    border: border.length ? border.join(', '): undefined,
  };

  const name = nameToVar(layer.name, ' ');
  const code = toJSText(name, style);

  const styleString = JSON.stringify(
    {
      CONTEXT: context,
      LAYER: layer,
    }, null, 2
  );

  return {
    code,
    language: 'javascript'
  };
};

function styleguideColors(context, colors) {

  const text = `const colors = {
${colors.map((color) => {
  return `  ${nameToVar(color.name)}: '${rgba(color)}',`
}).join('\n')}
};`;

  return {
    code: text,
    language: 'javascript'
  };
};
