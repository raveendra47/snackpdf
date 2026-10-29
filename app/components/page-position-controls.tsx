"use client";

import { useId, useState } from "react";

export interface PagePosition { x: number; y: number; width: number; height: number }

/** Percentages keep keyboard placement independent of preview size and zoom. */
export function PagePositionControls({ page, rectangle = false, disabled, onAdd }: {
  page: number; rectangle?: boolean; disabled: boolean; onAdd: (position: PagePosition) => void;
}) {
  const id = useId();
  const [values, setValues] = useState({ x: "10", y: "10", width: "20", height: "10" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const keys = rectangle ? ["x", "y", "width", "height"] as const : ["x", "y"] as const;
  const labels = { x: "From left (%)", y: "From top (%)", width: "Width (%)", height: "Height (%)" };
  return (
    <form className="position-controls" onSubmit={(event) => {
      event.preventDefault();
      if (disabled) return;
      const position = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) as unknown as PagePosition;
      if (keys.some((key) => !values[key].trim() || !Number.isFinite(position[key]) || position[key] < 0 || position[key] > 100)
        || (rectangle && (position.width <= 0 || position.height <= 0 || position.x + position.width > 100 || position.y + position.height > 100))) {
        setError(rectangle ? "Enter percentages from 0 to 100. Width and height must be above 0, and the box must fit on the page." : "Enter a position from 0 to 100 percent in both fields.");
        setMessage("");
        return;
      }
      setError("");
      onAdd({ x: position.x / 100, y: position.y / 100, width: position.width / 100, height: position.height / 100 });
      setMessage(`${rectangle ? "Redaction box" : "Annotation"} added to page ${page}.`);
    }}>
      <fieldset disabled={disabled} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}>
        <legend>{rectangle ? "Add a box by position" : "Place an annotation by position"} · page {page}</legend>
        <p id={`${id}-help`}>Positions are percentages measured from the top-left corner. Review the placement in the preview.</p>
        <div className="position-fields">
          {keys.map((key) => <label key={key} htmlFor={`${id}-${key}`}>{labels[key]}<input id={`${id}-${key}`} type="number" step="any" min="0" max="100" value={values[key]} aria-invalid={Boolean(error)} onChange={(event) => { setValues((current) => ({ ...current, [key]: event.target.value })); setMessage(""); }} /></label>)}
        </div>
        <button type="submit">{rectangle ? "Add redaction box" : "Add annotation"} to page {page}</button>
      </fieldset>
      {error ? <p className="inline-error" id={`${id}-error`} role="alert">{error}</p> : null}
      <p className="visually-hidden" role="status">{message}</p>
    </form>
  );
}
