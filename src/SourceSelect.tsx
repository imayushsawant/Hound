import React, { useEffect, useState, useRef } from "react";
import {
  APPLICATION_SOURCE_GROUPS,
  matchPresetSource,
} from "./shared/api";

export interface SourceSelectProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
}

export function SourceSelect({
  value,
  onChange,
  onBlur,
  id,
  name,
  placeholder = "Select source (optional)",
  required,
}: SourceSelectProps) {
  const presetMatch = matchPresetSource(value);
  const isCustomInitially = Boolean(value && !presetMatch);

  const [selectedOption, setSelectedOption] = useState<string>(() => {
    if (presetMatch) return presetMatch;
    if (isCustomInitially) return "Other";
    return "";
  });

  const [customText, setCustomText] = useState<string>(() => {
    return isCustomInitially ? value : "";
  });

  const customInputRef = useRef<HTMLInputElement>(null);

  // Sync when prop value changes externally
  useEffect(() => {
    const match = matchPresetSource(value);
    if (match) {
      setSelectedOption(match);
      setCustomText("");
    } else if (value && value.trim()) {
      setSelectedOption("Other");
      setCustomText(value);
    } else {
      setSelectedOption("");
      setCustomText("");
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVal = e.target.value;
    setSelectedOption(nextVal);

    if (nextVal === "Other") {
      // Focus custom input shortly after rendering
      setTimeout(() => customInputRef.current?.focus(), 50);
      onChange(customText || "");
      if (onBlur && customText) {
        onBlur(customText);
      }
    } else if (!nextVal) {
      setCustomText("");
      onChange("");
      onBlur?.("");
    } else {
      setCustomText("");
      onChange(nextVal);
      onBlur?.(nextVal);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setCustomText(nextText);
    onChange(nextText);
  };

  const handleCustomBlur = () => {
    onBlur?.(customText);
  };

  return (
    <div
      className="source-select-container"
      style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}
    >
      <select
        id={id}
        name={name}
        value={selectedOption}
        onChange={handleSelectChange}
        onBlur={() => {
          if (selectedOption !== "Other") {
            onBlur?.(selectedOption);
          }
        }}
        required={required}
        aria-label="Application source dropdown"
      >
        <option value="">{placeholder}</option>
        {APPLICATION_SOURCE_GROUPS.map((group) => (
          <optgroup key={group.category} label={group.category}>
            {group.sources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Custom">
          <option value="Other">Other (specify)</option>
        </optgroup>
      </select>

      {selectedOption === "Other" && (
        <input
          ref={customInputRef}
          type="text"
          value={customText}
          onChange={handleCustomChange}
          onBlur={handleCustomBlur}
          placeholder="e.g. Campus placement, Discord, Event..."
          aria-label="Custom application source"
          style={{
            fontSize: "14px",
            padding: "9px 12px",
          }}
        />
      )}
    </div>
  );
}
