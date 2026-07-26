"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  disabled = false,
  className = "",
  searchKeys = [],
  labelKey = "label", //["name","fullname"]
  valueKey = "value",
  emptyText = "No Data Found",
  dropdownPosition = "down",
  labelSeparator = " : ",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});

  const wrapperRef = useRef(null);

  // CLOSE OUTSIDE
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // SELECTED OPTION
  const selectedOption = useMemo(() => {
    return options.find((item) => String(item[valueKey]) === String(value));
  }, [options, value, valueKey]);

  // FILTERED OPTIONS
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;

    const lowerSearch = search.toLowerCase();

    return options.filter((item) => {
      return searchKeys.some((key) => {
        return String(item[key] || "")
          .toLowerCase()
          .includes(lowerSearch);
      });
    });
  }, [search, options, searchKeys]);

  const handleSelect = (item) => {
    onChange(item[valueKey], item);
    setOpen(false);
    setSearch("");
  };

  return (
    // <div
    //   ref={wrapperRef}
    //   className={`relative w-full ${className}`}
    // >
    <div
      ref={wrapperRef}
      className={`searchable-select relative w-full overflow-visible ${className}`}
    >
      {/* SELECT BUTTON */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();

          const DROPDOWN_HEIGHT = 260;
          const spaceBelow = window.innerHeight - rect.bottom;
          const goUp = dropdownPosition === "up" || spaceBelow < DROPDOWN_HEIGHT + 8;

          const dropdownWidth = Math.max(rect.width, 200);
          const clampedLeft = Math.min(
            rect.left,
            window.innerWidth - dropdownWidth - 8
          );

          setDropdownStyle({
            position: "fixed",
            top: goUp ? rect.top - DROPDOWN_HEIGHT - 4 : rect.bottom + 4,
            left: Math.max(0, clampedLeft),
            width: dropdownWidth,
            zIndex: 999999,
          });

          setOpen((prev) => !prev);
        }}
        className={`
          w-full
          h-[30px]
          border border-[#8f8f8f]
          rounded-sm
          bg-white
          px-2
          text-left
          text-[13px]
          font-normal
          flex
          items-center
          justify-between
          disabled:border-[#7fa37f]  
          disabled:bg-[#edf8ed] 
          disabled:text-gray-500
          disabled:cursor-not-allowed
        `}
      >
        <span className="truncate">
          {selectedOption
            ? Array.isArray(labelKey)
              ? labelKey
                  .map((key) => selectedOption[key])
                  .filter(Boolean)
                  .join(labelSeparator)
              : selectedOption[labelKey]
            : placeholder}
        </span>

        <ChevronDown size={16} />
      </button>

      {/* DROPDOWN */}
      {open && !disabled && (
        // <div
        //   className="
        //     absolute
        //     top-full
        //     left-0
        //     z-99999
        //     mt-1
        //     w-full
        //     border
        //     border-[#8f8f8f]
        //     rounded-sm
        //     bg-white
        //     shadow-md
        //   "
        // >
        <div
          className="
                border
                border-[#8f8f8f]
                rounded-sm
                bg-white
                shadow-xl
              "
          style={dropdownStyle}
        >
          {/* SEARCH */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full
                h-[30px]
                border border-[#8f8f8f]
                rounded-sm
                px-2
                text-[13px]
                font-normal
                outline-none
              "
            />
          </div>

          {/* OPTIONS */}
          <div className="max-h-[220px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item, idx) => {
                const isSelected = String(item[valueKey]) === String(value);

                return (
                  <button
                    type="button"
                    key={item[valueKey] != null ? String(item[valueKey]) : idx}
                    onClick={() => handleSelect(item)}
                    className={`
                      w-full
                      text-left
                      px-3
                      py-2
                      text-[13px]
                      hover:bg-[#d6e6f2]
                      border-b
                      border-gray-100
                      ${isSelected ? "bg-[#d6e6f2]" : "bg-white"}
                    `}
                  >
                    {Array.isArray(labelKey)
                      ? labelKey
                          .map((key) => item[key])
                          .filter(Boolean)
                          .join(labelSeparator)
                      : item[labelKey]}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-[13px] text-gray-500">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// example usage

// <SearchableSelect
//   options={vendorList}
//   value={watch("vendorId")}
//   onChange={(value) => setValue("vendorId", value)}
//   placeholder="SingleSelect Vendor"
//   labelKey="vendorName"
//   valueKey="vendorId"
//   searchKeys={["vendorName", "vendorCode", "mobile"]}
// />
