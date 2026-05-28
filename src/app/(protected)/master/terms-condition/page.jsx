"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { clearAuthCookies } from "@/lib/cookies";
import { router } from "next/client";
import { useRouter } from "next/navigation";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";

export default function TermsConditionPage() {
  const [terms, setTerms] = useState([]);

  const [header, setHeader] = useState("");
  const [subHeader, setSubHeader] = useState("");
  const [termDescription, setTermDescription] = useState("");

  const [selectedTermId, setSelectedTermId] = useState(null);

  const [formEnabled, setFormEnabled] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");

  const router = useRouter();
  const canEdit = isMasterEditable();

  const isViewMode = !canEdit;

  const [expandedDescriptionId, setExpandedDescriptionId] = useState(null);

  const [errors, setErrors] = useState({
    header: false,
    termDescription: false,
  });

  const fetchTerms = async () => {
    const termApi = API_ENDPOINTS?.MASTER?.TERM;

    if (!termApi?.LIST) {
      toast.error("Term list API config missing");
      return;
    }

    try {
      const res = await apiRequest({
        url: termApi.LIST,
        method: "GET",
      });

      setTerms(
        Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [],
      );
    } catch (error) {
      console.error("Fetch terms error:", error);
      toast.error(error?.message || "Failed to load terms");
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const resetForm = () => {
    setHeader("");
    setSubHeader("");
    setTermDescription("");
    setSelectedTermId(null);
    setCategory("");
    setErrors({
      header: false,
      termDescription: false,
    });
  };

  const handleAddHeader = () => {
    resetForm();
    setFormEnabled(true);
    setEditMode(false);
  };

  const handleEditButton = () => {
    if (isViewMode) {
      return;
    }
    setFormEnabled(true);
    setEditMode(true);
    resetForm();
    toast.info("Click a table row to edit");
  };

  const handleRowClick = (term) => {
    if (!editMode || !term) return;

    setSelectedTermId(term.termId);
    setHeader(term.header || "");
    setSubHeader(term.sub_header || "");
    setTermDescription(term.term_description || "");
    setCategory(term.category || "");
    setFormEnabled(true);
  };

  const handleSave = async () => {
    if (!formEnabled) {
      toast.error("Click + Header first");
      return;
    }

    const isHeaderEmpty = header.trim() === "";
    const isDescriptionEmpty = termDescription.trim() === "";

    setErrors({
      header: isHeaderEmpty,
      termDescription: isDescriptionEmpty,
    });

    if (isHeaderEmpty) {
      toast.error("Header is required");
      return;
    }

    if (isDescriptionEmpty) {
      toast.error("Terms description is required");
      return;
    }

    if (!category) {
      toast.error("Module is required");
      return;
    }

    const termApi = API_ENDPOINTS?.MASTER?.TERM;

    if (!termApi?.CREATE || !termApi?.UPDATE || !termApi?.LIST) {
      toast.error("Term API config missing");
      return;
    }

    try {
      setLoading(true);

      if (editMode && selectedTermId) {
        await apiRequest({
          url: `${termApi.UPDATE}/${selectedTermId}`,
          method: "PUT",
          data: {
            category,
            header: header.trim(),
            sub_header: subHeader.trim(),
            term_description: termDescription.trim(),
          },
        });

        toast.success("Term updated successfully");
      } else {
        await apiRequest({
          url: termApi.CREATE,
          method: "POST",
          data: {
            category,
            header: header.trim(),
            sub_header: subHeader.trim(),
            termDescription: termDescription.trim(),
          },
        });

        toast.success("Term created successfully");
      }

      await fetchTerms();
      resetForm();
      setFormEnabled(false);
      setEditMode(false);
    } catch (error) {
      console.error("Save term error:", error);
      toast.error(error?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, termId) => {
    e.stopPropagation();

    if (!editMode) return;

    if (!termId) {
      toast.error("Invalid term id");
      return;
    }

    const termApi = API_ENDPOINTS?.MASTER?.TERM;

    if (!termApi?.DELETE) {
      toast.error("Delete API config missing");
      return;
    }

    try {
      setLoading(true);

      await apiRequest({
        url: `${termApi.DELETE}/${termId}`,
        method: "DELETE",
      });

      toast.success("Term deleted successfully");

      await fetchTerms();
      resetForm();
      setFormEnabled(false);
      setEditMode(false);
    } catch (error) {
      console.error("Delete term error:", error);
      toast.error(error?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError) =>
    `
    h-8 rounded-sm border border-gray-500 bg-white px-2 text-sm
    ${hasError ? "border-red-500 ring-1 ring-red-400" : ""}
    disabled:bg-gray-100 disabled:cursor-not-allowed
  `;

  const actions = getPageActions({
    router,


    onPrint: () => window.print(),

    onDownload: () => {
      const doc = new jsPDF();

      doc.setFontSize(14);
      doc.text("Terms & Conditions", 14, 15);

      autoTable(doc, {
        startY: 25,
        head: [["Sl. No", "Header", "Sub Header", "Description"]],
        body: terms.map((term, index) => [
          index + 1,
          term.header || "",
          term.sub_header || "",
          term.term_description || "",
        ]),
      });

      doc.save("terms-condition.pdf");
    },
  });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="min-h-screen bg-white p-1 text-sm">
        <div className="mb-2 flex justify-end">
          <Button
            type="button"
            onClick={handleAddHeader}
            disabled={isViewMode}
            className="h-8 rounded-sm bg-sky-300 px-8 font-semibold text-black hover:bg-sky-400"
          >
            <Plus size={16} className="mr-1" />
            Header
          </Button>
        </div>

        <div className="mb-6 space-y-1">
          <div className="grid grid-cols-[270px_305px]">
            <label className="flex h-8 items-center rounded-l-sm border border-gray-500 bg-[#dceaf6] px-3 font-semibold">
              Header <span className="ml-1 text-red-600">*</span>
            </label>

            <Input
              disabled={isViewMode || !formEnabled}
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="Text"
              className={inputClass(errors.header)}
            />
          </div>

          <div className="grid grid-cols-[270px_305px]">
            <label className="flex h-8 items-center rounded-l-sm border border-gray-500 bg-[#dceaf6] px-3 font-semibold">
              Sub Header
            </label>

            <Input
              disabled={isViewMode || !formEnabled}
              value={subHeader}
              onChange={(e) => setSubHeader(e.target.value)}
              placeholder="Text"
              className={inputClass(false)}
            />
          </div>

          <div className="grid grid-cols-[270px_305px]">
            <label className="flex h-8 items-center rounded-l-sm border border-gray-500 bg-[#dceaf6] px-3 font-semibold">
              Module <span className="ml-1 text-red-600">*</span>
            </label>

            <select
              disabled={isViewMode || !formEnabled}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`
      h-8 rounded-r-sm border border-gray-500 bg-white px-2 text-sm
      disabled:bg-gray-100 disabled:cursor-not-allowed
    `}
            >
              <option value="">Select Module</option>

              {CATEGORY_OPTIONS.termsCategory.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[270px_1fr]">
            <label className="flex h-8 items-center rounded-l-sm border border-gray-500 bg-[#dceaf6] px-3 font-semibold">
              Terms Description <span className="ml-1 text-red-600">*</span>
            </label>

            <Input
              disabled={isViewMode || !formEnabled}
              value={termDescription}
              onChange={(e) => setTermDescription(e.target.value)}
              placeholder="Text"
              className={inputClass(errors.termDescription)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-[#c6e0b4]">
                <th className="w-[90px] border border-gray-300 py-1 font-bold">
                  Sl. no
                </th>
                <th className="w-[230px] border border-gray-300 py-1 font-bold">
                  Header
                </th>
                <th className="w-[230px] border border-gray-300 py-1 font-bold">
                  Sub Header
                </th>
                <th className="w-[180px] border border-gray-300 py-1 font-bold">
                  Module
                </th>
                <th className="border border-gray-300 py-1 font-bold">
                  Description
                </th>
                {!isViewMode && (
                  <th className="w-[100px] border border-gray-300 py-1 font-bold">
                    Delete
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {[
                ...terms,
                ...Array(Math.max(0, 6 - terms.length)).fill(null),
              ].map((term, index) => (
                <tr
                  key={term?.termId || `empty-${index}`}
                  onClick={() => term && handleRowClick(term)}
                  className={`
                    h-7
                    ${index % 2 === 0 ? "bg-[#f3f3f3]" : "bg-white"}
                    ${editMode && term ? "cursor-pointer hover:bg-yellow-100" : ""}
                  `}
                >
                  <td className="border border-gray-300 text-center">
                    {index + 1}
                  </td>

                  <td className="truncate border border-gray-300 px-2">
                    {term?.header || ""}
                  </td>

                  <td className="truncate border border-gray-300 px-2">
                    {term?.sub_header || ""}
                  </td>

                  <td className="truncate border border-gray-300 px-2">
                    {term?.category || ""}
                  </td>

                  <td
                    className="border border-gray-300 px-2"
                    onClick={(e) => {
                      e.stopPropagation();

                      if (term) {
                        setExpandedDescriptionId(
                          expandedDescriptionId === term.termId
                            ? null
                            : term.termId,
                        );
                      }
                    }}
                  >
                    {term ? (
                      <div
                        className={`
        cursor-pointer
        ${
          expandedDescriptionId === term.termId
            ? "whitespace-normal break-words"
            : "truncate"
        }
      `}
                        title="Click to view full description"
                      >
                        {term.term_description || ""}
                      </div>
                    ) : (
                      ""
                    )}
                  </td>
                  {!isViewMode && (
                    <td className="border border-gray-300 text-center">
                      {term && (
                        <button
                          type="button"
                          disabled={!editMode || loading}
                          onClick={(e) => handleDelete(e, term.termId)}
                          className={`
                          inline-flex items-center justify-center gap-1 rounded-sm px-2 py-[2px] text-xs font-semibold
                          ${
                            editMode
                              ? "bg-red-500 text-white hover:bg-red-600"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }
                        `}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isViewMode && (
          <div className="fixed bottom-2 right-4 flex gap-2">
            <Button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className="h-8 w-[140px] rounded-sm border border-orange-400 bg-orange-200 font-semibold text-black hover:bg-orange-300"
            >
              {loading ? "Saving..." : "Save"}
            </Button>

            <Button
              type="button"
              disabled={loading}
              onClick={() => {
                if (editMode) {
                  setEditMode(false);
                  setFormEnabled(false);
                  resetForm();
                } else {
                  handleEditButton();
                }
              }}
              className={`
            h-8 w-[140px] rounded-sm border border-blue-500 font-semibold
            ${
              editMode
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-blue-300 text-black hover:bg-blue-400"
            }
          `}
            >
              {editMode ? "Cancel" : "Edit"}
            </Button>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
