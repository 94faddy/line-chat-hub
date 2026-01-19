'use client';

import React, { useState, useRef, useEffect } from 'react';

interface FlexComponent {
  type: string;
  text?: string;
  contents?: FlexComponent[];
  url?: string;
  size?: string;
  color?: string;
  weight?: string;
  wrap?: boolean;
  flex?: number;
  margin?: string;
  spacing?: string;
  layout?: string;
  action?: FlexAction;
  aspectRatio?: string;
  aspectMode?: string;
  backgroundColor?: string;
  cornerRadius?: string;
  height?: string;
  width?: string;
  position?: string;
  paddingAll?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingStart?: string;
  paddingEnd?: string;
  borderWidth?: string;
  borderColor?: string;
  justifyContent?: string;
  alignItems?: string;
  offsetTop?: string;
  offsetBottom?: string;
  offsetStart?: string;
  offsetEnd?: string;
  style?: any;
  maxLines?: number;
  align?: string;
  gravity?: string;
  decoration?: string;
}

interface FlexAction {
  type: string;
  uri?: string;
  label?: string;
  text?: string;
  data?: string;
}

// แปลง LINE size เป็น pixel
const getSizeValue = (size?: string): number => {
  const sizeMap: Record<string, number> = {
    'xxs': 10, 'xs': 12, 'sm': 14, 'md': 16, 'lg': 18,
    'xl': 20, 'xxl': 24, '3xl': 28, '4xl': 32, '5xl': 36,
  };
  return sizeMap[size || 'md'] || 16;
};

// แปลง LINE spacing เป็น pixel
const getSpacingValue = (spacing?: string): number => {
  const spacingMap: Record<string, number> = {
    'none': 0, 'xs': 2, 'sm': 4, 'md': 8, 'lg': 12, 'xl': 16, 'xxl': 20,
  };
  if (!spacing) return 0;
  if (spacing.includes('px')) return parseInt(spacing);
  return spacingMap[spacing] || 0;
};

// Action wrapper
const ActionWrapper: React.FC<{ action?: FlexAction; children: React.ReactNode }> = ({ action, children }) => {
  if (!action) return <>{children}</>;

  if (action.type === 'uri' && action.uri) {
    return (
      <a href={action.uri} target="_blank" rel="noopener noreferrer"
        className="cursor-pointer hover:opacity-80 transition-opacity block"
        onClick={(e) => e.stopPropagation()}>
        {children}
      </a>
    );
  }
  return <div className="cursor-pointer hover:opacity-80">{children}</div>;
};

// Linkify text
const linkifyText = (text: string): React.ReactNode => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-blue-500 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return part;
  });
};

// Render Text
const renderText = (component: FlexComponent, index: number) => {
  const style: React.CSSProperties = {
    fontSize: getSizeValue(component.size),
    fontWeight: component.weight === 'bold' ? 'bold' : 'normal',
    color: component.color || '#000000',
    marginTop: getSpacingValue(component.margin),
    textAlign: (component.align as any) || 'left',
    textDecoration: component.decoration || 'none',
    wordBreak: 'break-word',
  };

  if (component.wrap === false) {
    style.whiteSpace = 'nowrap';
    style.overflow = 'hidden';
    style.textOverflow = 'ellipsis';
  }

  if (component.maxLines) {
    style.display = '-webkit-box';
    style.WebkitLineClamp = component.maxLines;
    style.WebkitBoxOrient = 'vertical';
    style.overflow = 'hidden';
  }

  return (
    <ActionWrapper key={index} action={component.action}>
      <p style={style}>{linkifyText(component.text || '')}</p>
    </ActionWrapper>
  );
};

// Render Image
const renderImage = (component: FlexComponent, index: number) => {
  if (!component.url) return null;

  // Handle size: xxs, xs, sm, md, lg, xl, xxl (สำหรับ icon-like images)
  const sizeMap: Record<string, number> = {
    'xxs': 16, 'xs': 20, 'sm': 24, 'md': 32, 'lg': 40, 'xl': 48, 'xxl': 56,
  };

  if (component.size && component.size !== 'full' && sizeMap[component.size]) {
    const size = sizeMap[component.size];
    const aspectRatio = component.aspectRatio || '1:1';
    const [w, h] = aspectRatio.split(':').map(Number);
    
    return (
      <img key={index} src={component.url} alt="" style={{
        width: size,
        height: size * (h / w),
        objectFit: component.aspectMode === 'cover' ? 'cover' : 'contain',
        flexShrink: 0,
        marginLeft: getSpacingValue(component.margin),
        borderRadius: component.cornerRadius,
      }} />
    );
  }

  // Handle size: full - ให้รูปเต็ม container
  if (component.size === 'full') {
    const aspectRatio = component.aspectRatio || '1:1';
    const [w, h] = aspectRatio.split(':').map(Number);
    const paddingTop = `${(h / w) * 100}%`;

    return (
      <div key={index} style={{
        position: 'relative',
        width: '100%',
        paddingTop,
        overflow: 'hidden',
        borderRadius: component.cornerRadius || '0',
        backgroundColor: component.backgroundColor,
      }}>
        <img src={component.url} alt="" style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          objectFit: component.aspectMode === 'cover' ? 'cover' : 'contain',
        }} />
      </div>
    );
  }

  // Default: aspect ratio based
  const aspectRatio = component.aspectRatio || '1:1';
  const [w, h] = aspectRatio.split(':').map(Number);
  const paddingTop = `${(h / w) * 100}%`;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    paddingTop,
    overflow: 'hidden',
    borderRadius: component.cornerRadius || '0',
    marginTop: getSpacingValue(component.margin),
    backgroundColor: component.backgroundColor,
  };

  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    objectFit: component.aspectMode === 'cover' ? 'cover' : 'contain',
  };

  return (
    <ActionWrapper key={index} action={component.action}>
      <div style={containerStyle}>
        <img src={component.url} alt="" style={imgStyle} />
      </div>
    </ActionWrapper>
  );
};

// Render Icon
const renderIcon = (component: FlexComponent, index: number) => {
  if (!component.url) return null;

  const sizeMap: Record<string, number> = {
    'xxs': 12, 'xs': 16, 'sm': 20, 'md': 24, 'lg': 32, 'xl': 40, 'xxl': 48,
  };
  
  let size = sizeMap[component.size || 'md'] || 24;
  if (component.size?.includes('px')) {
    size = parseInt(component.size);
  }

  return (
    <img key={index} src={component.url} alt=""
      style={{
        width: size, height: size,
        objectFit: 'contain',
        flexShrink: 0,
        marginLeft: getSpacingValue(component.margin),
      }}
    />
  );
};

// Render Button
const renderButton = (component: FlexComponent, index: number) => {
  const action = component.action;
  if (!action) return null;

  // Handle style
  const isSecondary = component.style === 'secondary';
  const bgColor = component.color || (isSecondary ? '#eeeeee' : '#06C755');
  const textColor = isSecondary ? '#000000' : '#ffffff';

  const style: React.CSSProperties = {
    width: '100%',
    padding: component.height === 'sm' ? '8px 12px' : '12px 16px',
    backgroundColor: bgColor,
    color: textColor,
    borderRadius: '6px',
    border: 'none',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: getSpacingValue(component.margin),
  };

  const buttonContent = (
    <button style={style}>
      {action.label || action.text || 'Button'}
    </button>
  );

  if (action.type === 'uri' && action.uri) {
    return (
      <a key={index} href={action.uri} target="_blank" rel="noopener noreferrer" 
        style={{ display: 'block', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
        {buttonContent}
      </a>
    );
  }
  return <div key={index}>{buttonContent}</div>;
};

// Render Separator
const renderSeparator = (component: FlexComponent, index: number) => (
  <hr key={index} style={{
    border: 'none',
    borderTop: `1px solid ${component.color || '#e0e0e0'}`,
    margin: `${getSpacingValue(component.margin)}px 0`,
  }} />
);

// Render Spacer
const renderSpacer = (component: FlexComponent, index: number) => {
  const sizeMap: Record<string, number> = {
    'xs': 4, 'sm': 8, 'md': 16, 'lg': 24, 'xl': 32, 'xxl': 40,
  };
  return <div key={index} style={{ height: sizeMap[component.size || 'md'] || 16 }} />;
};

// Render Box (recursive)
const renderBox = (component: FlexComponent, index: number): React.ReactNode => {
  const isHorizontal = component.layout === 'horizontal' || component.layout === 'baseline';
  
  // ตรวจสอบว่ามี child ที่ใช้ position absolute หรือไม่
  const hasAbsoluteChild = component.contents?.some(c => c.position === 'absolute');

  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    gap: getSpacingValue(component.spacing),
    marginTop: getSpacingValue(component.margin),
    alignItems: component.layout === 'baseline' ? 'flex-end' : 
                isHorizontal ? (component.alignItems === 'center' ? 'center' : 
                               component.alignItems === 'flex-end' ? 'flex-end' : 'flex-start') : undefined,
    justifyContent: component.justifyContent || undefined,
    padding: component.paddingAll || undefined,
    paddingTop: component.paddingTop,
    paddingBottom: component.paddingBottom,
    paddingLeft: component.paddingStart,
    paddingRight: component.paddingEnd,
    backgroundColor: component.backgroundColor,
    borderRadius: component.cornerRadius,
    borderWidth: component.borderWidth,
    borderColor: component.borderColor,
    borderStyle: component.borderWidth ? 'solid' : undefined,
    width: component.width,
    height: component.height,
    // Position handling
    position: component.position === 'absolute' ? 'absolute' : (hasAbsoluteChild ? 'relative' : undefined),
    top: component.offsetTop,
    bottom: component.offsetBottom,
    left: component.offsetStart,
    right: component.offsetEnd,
  };

  const renderChildren = () => {
    return component.contents?.map((child, i) => {
      if (child.flex !== undefined && child.flex > 0) {
        return (
          <div key={i} style={{ flex: child.flex, minWidth: 0 }}>
            {renderComponent(child, i)}
          </div>
        );
      }
      return renderComponent(child, i);
    });
  };

  return (
    <ActionWrapper key={index} action={component.action}>
      <div style={style}>{renderChildren()}</div>
    </ActionWrapper>
  );
};

// Main render component
const renderComponent = (component: FlexComponent, index: number): React.ReactNode => {
  if (!component || !component.type) return null;
  
  switch (component.type) {
    case 'text': return renderText(component, index);
    case 'image': return renderImage(component, index);
    case 'button': return renderButton(component, index);
    case 'box': return renderBox(component, index);
    case 'separator': return renderSeparator(component, index);
    case 'spacer': return renderSpacer(component, index);
    case 'icon': return renderIcon(component, index);
    case 'filler': return <div key={index} style={{ flex: 1 }} />;
    case 'span':
      return (
        <span key={index} style={{ 
          color: component.color, 
          fontSize: getSizeValue(component.size),
          fontWeight: component.weight === 'bold' ? 'bold' : 'normal'
        }}>
          {component.text}
        </span>
      );
    default: return null;
  }
};

// Bubble Renderer
const BubbleRenderer: React.FC<{ content: any; equalHeight?: boolean }> = ({ content, equalHeight }) => {
  const flex = typeof content === 'string' ? JSON.parse(content) : content;
  const styles = flex.styles || {};

  // ตรวจสอบว่า body มี child ที่ใช้ position absolute หรือไม่
  const bodyHasAbsolute = flex.body?.contents?.some((c: any) => c.position === 'absolute');

  const containerStyle: React.CSSProperties = {
    backgroundColor: styles.body?.backgroundColor || flex.body?.backgroundColor || '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    border: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    height: equalHeight ? '100%' : 'auto',
    minHeight: equalHeight ? '320px' : 'auto',
  };

  const getBlockStyle = (blockStyles: any, block: any): React.CSSProperties => ({
    backgroundColor: blockStyles?.backgroundColor || block?.backgroundColor,
  });

  return (
    <div style={containerStyle}>
      {/* Hero */}
      {flex.hero && (
        <div style={{ ...getBlockStyle(styles.hero, flex.hero), flexShrink: 0 }}>
          {renderComponent(flex.hero, 0)}
        </div>
      )}
      
      {/* Header */}
      {flex.header && (
        <div style={{ 
          padding: '12px', 
          flexShrink: 0,
          ...getBlockStyle(styles.header, flex.header) 
        }}>
          {flex.header.contents?.map((child: FlexComponent, i: number) => renderComponent(child, i))}
        </div>
      )}
      
      {/* Body - รองรับ position relative สำหรับ absolute children */}
      {flex.body && (
        <div style={{ 
          padding: flex.body.paddingAll === '0px' ? 0 : (flex.body.paddingAll || '12px'),
          paddingTop: flex.body.paddingTop,
          paddingBottom: flex.body.paddingBottom,
          paddingLeft: flex.body.paddingStart,
          paddingRight: flex.body.paddingEnd,
          flex: 1, 
          overflow: 'hidden',
          position: bodyHasAbsolute ? 'relative' : undefined,
          ...getBlockStyle(styles.body, flex.body) 
        }}>
          {flex.body.contents?.map((child: FlexComponent, i: number) => renderComponent(child, i))}
        </div>
      )}
      
      {/* Footer */}
      {flex.footer && (
        <div style={{ 
          padding: '12px', 
          paddingTop: '8px',
          flexShrink: 0, 
          marginTop: 'auto',
          ...getBlockStyle(styles.footer, flex.footer) 
        }}>
          {flex.footer.contents?.map((child: FlexComponent, i: number) => renderComponent(child, i))}
        </div>
      )}
    </div>
  );
};

// Carousel Slider
const CarouselSlider: React.FC<{ bubbles: any[] }> = ({ bubbles }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ขนาด bubble ตาม size (mega = กว้างกว่า)
  const bubbleWidth = 260;
  const gap = 8;
  const totalWidth = bubbles.length * bubbleWidth + (bubbles.length - 1) * gap;

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // ไม่ต้อง navigation ถ้าแสดงได้หมด
  const needsNavigation = containerWidth > 0 && totalWidth > containerWidth;
  const maxScroll = Math.max(0, totalWidth - containerWidth);
  const maxIndex = Math.ceil(maxScroll / bubbleWidth);

  const goNext = () => setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  const goPrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));
  const scrollAmount = Math.min(currentIndex * bubbleWidth, maxScroll);

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {/* Left Button */}
      {needsNavigation && currentIndex > 0 && (
        <button onClick={goPrev} style={{
          position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #ddd',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <svg width="16" height="16" fill="none" stroke="#666" strokeWidth="2">
            <path d="M10 4l-6 6 6 6" />
          </svg>
        </button>
      )}

      {/* Carousel */}
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'flex', gap: `${gap}px`,
          transform: `translateX(-${scrollAmount}px)`,
          transition: 'transform 0.3s ease',
        }}>
          {bubbles.map((bubble, i) => (
            <div key={i} style={{ flexShrink: 0, width: bubbleWidth }}>
              <BubbleRenderer content={bubble} equalHeight />
            </div>
          ))}
        </div>
      </div>

      {/* Right Button */}
      {needsNavigation && currentIndex < maxIndex && (
        <button onClick={goNext} style={{
          position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #ddd',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <svg width="16" height="16" fill="none" stroke="#666" strokeWidth="2">
            <path d="M6 4l6 6-6 6" />
          </svg>
        </button>
      )}

      {/* Dots */}
      {needsNavigation && maxIndex > 0 && maxIndex <= 10 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button key={i} onClick={() => setCurrentIndex(i)} style={{
              width: currentIndex === i ? 12 : 6, height: 6, borderRadius: 3,
              backgroundColor: currentIndex === i ? '#666' : '#ccc',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Export
export const FlexMessageRenderer: React.FC<{ content: string | object }> = ({ content }) => {
  try {
    let flex: any;
    
    if (typeof content === 'string') {
      if (content === '[object Object]') {
        return <div style={{ background: '#f0f0f0', padding: 8, borderRadius: 4, fontSize: 14, color: '#666' }}>[Flex Message]</div>;
      }
      flex = JSON.parse(content);
    } else if (typeof content === 'object' && content !== null) {
      flex = content;
    } else {
      throw new Error('Invalid content');
    }

    if (flex.type === 'bubble') {
      return (
        <div style={{ maxWidth: 300 }}>
          <BubbleRenderer content={flex} />
        </div>
      );
    }

    if (flex.type === 'carousel') {
      return (
        <div style={{ maxWidth: 900 }}>
          <CarouselSlider bubbles={flex.contents || []} />
        </div>
      );
    }

    return (
      <div style={{ background: '#f0f0f0', padding: 12, borderRadius: 8, maxWidth: 280 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>[Flex Message]</div>
        {flex.altText && <p style={{ fontSize: 14 }}>{flex.altText}</p>}
      </div>
    );
  } catch (e) {
    console.error('Flex parse error:', e);
    return <div style={{ background: '#f0f0f0', padding: 8, borderRadius: 4, fontSize: 14, color: '#666' }}>[Flex Message]</div>;
  }
};

// Export utility
export const LinkifyText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all"
              onClick={(e) => e.stopPropagation()}>
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
};

export default FlexMessageRenderer;