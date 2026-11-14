import React, { useEffect, useMemo, useRef, useState } from "react";
import { getOrderedCountries, isPredefinedCity } from "./locations";

interface LocationSelectorProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  country?: string;
  id?: string;
  placeholder?: string;
}

export function LocationSelector({
  value,
  onChange,
  onBlur,
  country,
  id,
  placeholder = "Select location...",
}: LocationSelectorProps) {
  const orderedCountries = useMemo(() => getOrderedCountries(country), [country]);
  const isKnown = value === "Remote" || isPredefinedCity(value) || value === "";
  
  const [customMode, setCustomMode] = useState<boolean>(!isKnown && !!value);
  const [customText, setCustomText] = useState<string>(!isKnown ? value : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPredefinedCity(value) && value !== "Remote" && !!value) {
      setCustomMode(true);
      setCustomText(value);
    } else if (isPredefinedCity(value) || value === "Remote" || !value) {
      if (!customMode) {
        setCustomText("");
      }
    }
  }, [value]);

  const selectValue = customMode ? "__other__" : value;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === "__other__") {
      setCustomMode(true);
      onChange(customText);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(text);
  };

  return (
    <div className="location-selector" style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <select
        id={id}
        value={selectValue}
        onChange={handleSelectChange}
        onBlur={onBlur}
        style={{ width: "100%" }}
      >
        <option value="">{placeholder}</option>
        <option value="Remote">Remote</option>
        {orderedCountries.map((c, idx) => (
          <optgroup
            key={c.name}
            label={idx === 0 ? `${c.flag} ${c.name} (Your Country)` : `${c.flag} ${c.name}`}
          >
            {c.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="__other__">Other (enter custom location)...</option>
      </select>

      {customMode && (
        <input
          ref={inputRef}
          type="text"
          value={customText}
          placeholder="Specify city, state or country..."
          onChange={handleCustomChange}
          onBlur={onBlur}
          style={{
            fontSize: "12px",
            padding: "7px 11px",
            borderRadius: "6px",
            animation: "fadeIn 0.15s ease",
          }}
        />
      )}
    </div>
  );
}
