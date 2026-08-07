import React, { useState, useRef, useEffect } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
  description?: string;
}

interface SearchableInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function SearchableInput({
  value,
  onChange,
  options,
  placeholder = "Type or select...",
  className
}: SearchableInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter options based on current value
  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes((value || "").toLowerCase()) || 
    (opt.description && opt.description.toLowerCase().includes((value || "").toLowerCase()))
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative w-full", className)} ref={wrapperRef}>
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-md max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className="px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
                onClick={() => {
                  onChange(opt.name);
                  setIsOpen(false);
                }}
              >
                <div className="font-medium">{opt.name}</div>
                {opt.description && <div className="text-xs text-muted-foreground">{opt.description}</div>}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {value ? `Use custom: "${value}"` : "No options available."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
