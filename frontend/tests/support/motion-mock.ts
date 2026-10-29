import * as React from "react";

const components = new Map<string, React.ComponentType<Record<string, unknown>>>();
const ignoredMotionProps = new Set([
  "animate",
  "custom",
  "exit",
  "initial",
  "layout",
  "layoutId",
  "onUpdate",
  "transition",
  "variants",
  "viewport",
  "whileFocus",
  "whileHover",
  "whileInView",
  "whileTap",
]);

export const motion = new Proxy(
  {},
  {
    get: (_target, element) => {
      const tag = String(element);
      if (!components.has(tag)) {
        const component = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !ignoredMotionProps.has(key)),
          );
          return React.createElement(tag, { ...domProps, ref }, props.children as React.ReactNode);
        });
        component.displayName = `Motion(${tag})`;
        components.set(tag, component);
      }
      return components.get(tag);
    },
  },
);

export const AnimatePresence = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const MotionConfig = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const useInView = () => true;
export const useReducedMotion = () => true;
