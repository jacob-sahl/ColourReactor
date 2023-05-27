import Color from 'colorjs.io';
import CSS from 'csstype';
import { MouseEvent, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { RenderMap } from '../State/BoardObjects/Maps';
import { createPaint } from '../State/BoardObjects/Paint';
import { loadObjects } from '../State/Slices/boardSlice';
import { RootState } from '../State/rootReducer';
import { BoardObjectCSSClass, BoardObjectRenderOptions, BoardObjectRenderOutput, CursorMode } from '../types';

interface Props {
  x: number;
  y: number;
}

interface SquareRenderInfoEntry {
  objectCSSClasses: BoardObjectCSSClass[];
  backgroundColor: Color;
}

const GlobalSquareRenderingInfo = new Map<string, SquareRenderInfoEntry>();

const Square = (props: Props): JSX.Element => {
  const squareTag = `${props.x}-${props.y}`;
  const dispatch = useDispatch();

  const squareState = useSelector((state: RootState) => state.board.squares[props.y][props.x]);
  const pixelSize = useSelector((state: RootState) => state.board.pixelSquareSize);

  const timeDelta = useSelector((state: RootState) => state.app.timeDelta);
  const ticksElapsed = useSelector((state: RootState) => state.board.ticksElapsed);
  const prevTickRef = useRef<number>(ticksElapsed);

  const outlineColour = new Color('rgb(235, 235, 235)');

  const defaultColorString = useSelector((state: RootState) => state.app.defaultColor);
  const defaultColor = new Color(defaultColorString);

  const cursorColor = useSelector((state: RootState) => state.app.cursorColor);
  const paintColor = useSelector((state: RootState) => state.app.paintOps.primary);
  const cursorMode = useSelector((state: RootState) => state.app.cursorMode);

  // This should only run on the very first render
  if (!GlobalSquareRenderingInfo.has(squareTag)) {
    GlobalSquareRenderingInfo.set(squareTag, {
      objectCSSClasses: [],
      backgroundColor: defaultColor,
    });
  }

  const [hovering, setHovering] = useState(false);
  const [rotateY, setRotateY] = useState(false);
  const [rotateX, setRotateX] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [animTrigger, setAnimTrigger] = useState('');

  const renderingInfo: SquareRenderInfoEntry = GlobalSquareRenderingInfo.get(squareTag) as SquareRenderInfoEntry;

  const style: CSS.Properties = {
    outline: `1px solid ${outlineColour}`,
    height: `${pixelSize}px`,
    minWidth: `${pixelSize}px`,
    backgroundColor: defaultColor.toString(),
    transition: `background-color ${timeDelta}ms ease`,
  };

  let combinedColor = defaultColor;

  // This should only run ONCE per tick
  if (ticksElapsed > prevTickRef.current) {
    for (const object of squareState.content) {
      const renderFunction = RenderMap.get(object.tag);
      const renderOps: BoardObjectRenderOptions = { obj: object, backgroundColor: combinedColor };
      if (renderFunction) {
        const renderOut: BoardObjectRenderOutput = renderFunction(renderOps);

        // Replace the current color with the one from this render pass
        combinedColor = renderOut.backgroundColor;

        for (const renderClass of renderOut.cssClasses) {
          // Add the renderer classes to the global scope map
          renderingInfo.objectCSSClasses.push(renderClass);

          // When the animation times out, remove it from the rendering classes and force a component re-render
          const timeout = setTimeout(() => {
            renderingInfo.objectCSSClasses = renderingInfo.objectCSSClasses.filter(
              (entry) => entry.uid !== renderClass.uid,
            );
            clearTimeout(timeout);
            setAnimTrigger(uuidv4());
          }, renderClass.duration);
        }
      }
    }
    renderingInfo.backgroundColor = combinedColor;
    prevTickRef.current = ticksElapsed;
  } else {
    combinedColor = renderingInfo.backgroundColor;
  }

  // HOVER STYLE
  switch (cursorMode) {
    case CursorMode.default:
      if (hovering) {
        combinedColor = Color.mix(combinedColor, new Color(cursorColor)) as unknown as Color;
      }
      break;
    case CursorMode.painting:
      if (hovering) {
        style.outline = `2px dashed ${paintColor}`;
        style.zIndex = 2;
      }
      break;
  }

  style.backgroundColor = combinedColor.toString();

  let renderClassString = ' ';
  for (const objectCSSClass of renderingInfo.objectCSSClasses) {
    renderClassString += objectCSSClass.className + ' ';
  }

  // #region
  // EVENT FUNCTIONS

  const handleMouseOver = () => {
    setHovering(true);
  };

  const handleMouseOut = () => {
    setHovering(false);
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    switch (cursorMode) {
      case CursorMode.default:
        if (e.ctrlKey) {
          rotateSquareY();
          return;
        }
        if (e.altKey) {
          rotateSquareX();
          return;
        }
        break;
      case CursorMode.painting:
        console.log('Trying to paint');
        if (e.button === 0) {
          dispatch(loadObjects([createPaint({ primary: paintColor }, props.x, props.y)]));
        } else if (e.button === 2) {
        } else {
        }
        break;
    }
  };

  const handleMouseUp = () => {};

  const handleMouseDown = () => {};

  const rotateSquareY = () => {
    setRotateY(!rotateY);
  };

  const rotateSquareX = () => {
    setRotateX(!rotateX);
  };

  return (
    <div
      className={'square ' + renderClassString + (rotateY ? 'rotate3d-y ' : '') + (rotateX ? 'rotate3d-x ' : '')}
      style={style}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
    ></div>
  );
};

export default Square;
