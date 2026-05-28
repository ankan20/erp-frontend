"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

import { Search, Plus, Minus, Save } from "lucide-react";

import DataTable from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SingleSelect from "@/components/common/SingleSelect";
import MultiSelect from "@/components/common/MultiSelect";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

import { apiRequest } from "@/lib/apiClient";

import { API_ENDPOINTS } from "@/config/api.config";

import { clearAuthCookies } from "@/lib/cookies";
import { toast } from "sonner";
import { router } from "next/client";
import { useRouter } from "next/navigation";
import CreatorUsersPopup from "@/components/settings/approval-path/CreatorUsersPopup";

// Generate Safe Module Code

const generateModuleCode = (title = "") => {
  return title
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
};

// approved Module

const approvalModules = [
  {
    title: "Resource Management",
    moduleCode: "resource_management",
    children: [
      {
        title: "Procurement",
        moduleCode: "procurement",
        children: [
          { title: "Indent", moduleCode: "indent" },
          { title: "Enquiry", moduleCode: "enquiry" },
          { title: "Order", moduleCode: "order" },
        ],
      },
      {
        title: "Material Management",
        moduleCode: "material_management",
        children: [
          { title: "Goods Received Note", moduleCode: "goods_received_note" },
          { title: "Goods Issue Note", moduleCode: "goods_issue_note" },
        ],
      },
      {
        title: "Manpower Management",
        moduleCode: "manpower_management",
        children: [
          { title: "Labour ID", moduleCode: "labour_id" },
          { title: "DLR Entry", moduleCode: "dlr_entry" },
          { title: "DLR Report", moduleCode: "dlr_report" },
        ],
      },
      {
        title: "Machinery Management",
        moduleCode: "machinery_management",
        children: [
          { title: "Log Sheet", moduleCode: "log_sheet" },
          {
            title: "Machinery Stock Summary",
            moduleCode: "machinery_stock_summary",
          },
          { title: "Monthly Rent", moduleCode: "monthly_rent" },
        ],
      },
      {
        title: "Vendor Billing",
        moduleCode: "vendor_billing",
        children: [
          { title: "Billing by GRN", moduleCode: "billing_by_grn" },
          { title: "Billing by SRN", moduleCode: "billing_by_srn" },
        ],
      },
    ],
  },
  {
    title: "Asset Management",
    moduleCode: "asset_management",
    children: [
      { title: "Indent Allocation", moduleCode: "indent_allocation" },
      { title: "Asset ID", moduleCode: "asset_id" },
      { title: "Asset Report", moduleCode: "asset_report" },
    ],
  },
  {
    title: "Project Management",
    moduleCode: "project_management",
    children: [
      { title: "Order & BOQ", moduleCode: "order_boq" },
      { title: "Budget & Costing", moduleCode: "budget_costing" },
      {
        title: "Planning",
        moduleCode: "planning",
        children: [
          { title: "Monthly Planning", moduleCode: "monthly_planning" },
          {
            title: "Daily Progress Report",
            moduleCode: "daily_progress_report",
          },
          { title: "Reconciliation", moduleCode: "reconciliation" },
        ],
      },
      {
        title: "Sale Billing",
        moduleCode: "sale_billing",
        children: [
          { title: "Certified Bill", moduleCode: "certified_bill" },
          { title: "Hold /Amend Pending.", moduleCode: "hold_amend_pending" },
          { title: "Work In Progress", moduleCode: "work_in_progress" },
        ],
      },
      {
        title: "Register",
        moduleCode: "register",
        children: [
          { title: "Drawing Register", moduleCode: "drawing_register" },
          { title: "BBS Register", moduleCode: "bbs_register" },
          { title: "Concrete Register", moduleCode: "concrete_register" },
          { title: "Hindrance Register", moduleCode: "hindrance_register" },
        ],
      },
    ],
  },
  {
    title: "Finance Management",
    moduleCode: "finance_management",
    children: [
      {
        title: "Accounts",
        moduleCode: "accounts",
        children: [
          { title: "Sale", moduleCode: "sale" },
          { title: "Purchases", moduleCode: "purchases" },
          { title: "Receipt", moduleCode: "receipt" },
          { title: "Payment", moduleCode: "payment" },
          { title: "Contra", moduleCode: "contra" },
          { title: "Debit Note", moduleCode: "debit_note" },
          { title: "Credit Note", moduleCode: "credit_note" },
          { title: "Journal", moduleCode: "journal" },
        ],
      },
    ],
  },
];

// Hidden Modules

const HIDDEN_MODULES = [
  "settings",
  "master",
  "company_details",
  "user_id_and_password",
  "project_code",
  "roles_and_user_assignment",
  "approval_path_line_and_user",
  "ledger_code",
  "item_code",
  "asset_code",
  "unit",
  "cost_center_code",
  "category_and_group",
  "stock_report",
];

const getModuleRowMap = () => {
  const map = {};

  const build = (items, path = []) => {
    items.forEach((item, index) => {
      const title = item?.title || "";

      const currentPath = [...path, index + 1];

      const rowId = currentPath.join("-");

      const moduleCode = item.moduleCode || generateModuleCode(title);

      if (!HIDDEN_MODULES.includes(moduleCode)) {
        map[moduleCode] = rowId;
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        build(item.children, currentPath);
      }
    });
  };

  // Use Manual Approval Modules

  build(approvalModules);

  return map;
};

export default function ApprovalPathPage() {
  // States

  const [projectCode, setProjectCode] = useState("");

  const [projectName, setProjectName] = useState("");

  const [projectTitle, setProjectTitle] = useState("");

  const [users, setUsers] = useState([]);

  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState({});

  const [levels, setLevels] = useState(["Level1", "Level2"]);

  const [creatorPopup, setCreatorPopup] = useState({
    open: false,
    users: [],
  });

  // Load Saved Levels

  useEffect(() => {
    try {
      const saved = localStorage.getItem("approvalLevels");

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length >= 2) {
          setLevels(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load saved levels", err);
    }
  }, []);

  // Persist Levels

  useEffect(() => {
    localStorage.setItem("approvalLevels", JSON.stringify(levels));
  }, [levels]);

  // Load Projects

  const loadProjects = async () => {
    try {
      setLoading(true);

      const response = await apiRequest({
        url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS,

        method: "GET",
      });

      const projectData = Array.isArray(response?.data) ? response.data : [];

      setProjects(projectData);
    } catch (err) {
      console.error("Failed to load projects", err);

      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // call the approval get api

  const loadApprovalPath = async (projectCode) => {
    try {
      const response = await apiRequest({
        url: `${API_ENDPOINTS.SETTINGS.APPROVAL_PATH.LIST}?projectCode=${encodeURIComponent(projectCode)}`,
        method: "GET",
      });

      const approvalData = Array.isArray(response?.data)
        ? response.data[0]
        : response?.data;

      const modules = Array.isArray(approvalData?.modules)
        ? approvalData.modules
        : [];

      const moduleRowMap = getModuleRowMap();

      const restoredSelectedUsers = {};

      modules.forEach((module) => {
        const rowId = moduleRowMap[module.moduleCode];

        if (!rowId) return;

        restoredSelectedUsers[`${rowId}_creator`] =
          module.creatorUsers?.map((user) => Number(user.userId)) || [];

        module.approverUsers?.forEach((user) => {
          restoredSelectedUsers[`${rowId}_Level${user.level}`] = [
            Number(user.userId),
          ];
        });
      });

      setSelectedUsers(restoredSelectedUsers);

      const maxLevel = modules.reduce((max, module) => {
        const moduleMaxLevel = Math.max(
          0,
          ...(module.approverUsers || []).map((user) => Number(user.level)),
        );

        return Math.max(max, moduleMaxLevel);
      }, 2);

      setLevels(
        Array.from({ length: maxLevel }, (_, index) => `Level${index + 1}`),
      );
    } catch (err) {
      console.error("Failed to load approval path", err);
    }
  };

  // Load creator
  const loadCreatorUsers = async (projectCode) => {
    try {
      const response = await apiRequest({
        url: `${API_ENDPOINTS.SETTINGS.APPROVAL_PATH.EDIT_USERS}?projectCode=${encodeURIComponent(projectCode)}`,

        method: "GET",
      });

      const editUsersData = response?.data || {};

      const moduleRowMap = getModuleRowMap();

      setSelectedUsers((prev) => {
        const updated = { ...prev };

        Object.entries(editUsersData).forEach(([key, users]) => {
          const [moduleCode, permission] = key.split(".");

          if (permission !== "EDIT") return;

          const rowId = moduleRowMap[moduleCode];

          if (!rowId) return;

          updated[`${rowId}_creator`] = Array.isArray(users)
            ? users.map((user) => Number(user.id))
            : [];
        });

        return updated;
      });
    } catch (error) {
      console.error("Failed to load creator users", error);

      toast.error("Failed to load creator users");
    }
  };

  // Search Project + Load Users

  const handleSearch = async () => {
    try {
      if (!projectCode.trim()) {
        toast.error("Please enter project code");

        return;
      }

      const matchedProject = projects.find(
        (project) =>
          String(project.projectCode).trim().toUpperCase() ===
          String(projectCode).trim().toUpperCase(),
      );

      if (!matchedProject) {
        toast.error("Project not found");

        setProjectName("");
        setProjectTitle("");
        setUsers([]);

        return;
      }

      setProjectName(matchedProject.projectName || "");

      setProjectTitle(matchedProject.clientName || "");

      const usersResponse = await apiRequest({
        url: `${API_ENDPOINTS.SETTINGS.APPROVAL_PATH.GET_USERS_BY_PROJECT}?projectCode=${encodeURIComponent(matchedProject.projectCode)}`,

        method: "GET",
      });

      const userData = Array.isArray(usersResponse?.data)
        ? usersResponse.data
        : [];

      setUsers(userData);

      await loadApprovalPath(matchedProject.projectCode);

      await loadCreatorUsers(matchedProject.projectCode);
    } catch (err) {
      console.error("Search failed", err);

      toast.error(err?.message || "Failed to fetch project users");
    }
  };

  // Add Level

  const addLevel = () => {
    setLevels((prev) => [...prev, `Level${prev.length + 1}`]);
  };

  // Remove Level

  const removeLevel = () => {
    if (levels.length <= 2) return;

    const lastLevel = levels[levels.length - 1];

    setSelectedUsers((prev) => {
      const updated = { ...prev };

      Object.keys(updated).forEach((key) => {
        if (key.endsWith(`_${lastLevel}`)) {
          delete updated[key];
        }
      });

      return updated;
    });

    setLevels((prev) => prev.slice(0, -1));
  };

  // Handle SingleSelect Change

  const handleUserChange = useCallback((rowId, field, value) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [`${rowId}_${field}`]: value,
    }));
  }, []);

  // Render SingleSelect

  const renderSelect = (rowId, field) => (
    <SingleSelect
      placeholder="Select User"
      value={selectedUsers[`${rowId}_${field}`] || ""}
      onChange={(value) => handleUserChange(rowId, field, value)}
      options={users.map((user) => ({
        value: String(user.id),

        label: user.userName || "Unknown User",
      }))}
    />
  );

  // Build Table Data

  const tableData = useMemo(() => {
    const rows = [];

    const buildRows = (items, level, path = []) => {
      items.forEach((item, index) => {
        const title = item?.title || "";

        const currentPath = [...path, index + 1];

        const rowId = currentPath.join("-");

        const moduleCode = item.moduleCode || generateModuleCode(title);

        const shouldHide = HIDDEN_MODULES.includes(moduleCode);

        const indent = level * 24;

        // Check Children

        const hasChildren =
          Array.isArray(item.children) && item.children.length > 0;

        const shouldShowSelect = level >= 2 || (level === 1 && !hasChildren);

        if (!shouldHide) {
          rows.push({
            id: rowId,
            moduleCode,

            name: (
              <div
                className={`
                                py-2
                                px-4
                                border-l-4

                                ${
                                  level === 0
                                    ? "bg-sky-100 font-bold text-[24px]"
                                    : ""
                                }

                                ${
                                  level === 1
                                    ? "bg-green-100 font-semibold text-[18px]"
                                    : ""
                                }

                                ${level >= 2 ? "text-[16px]" : ""}
                                `}
                style={{
                  marginLeft: indent,
                }}
              >
                {currentPath.join(".")} {title}
              </div>
            ),

            creator: shouldShowSelect
              ? (() => {
                  const creatorUsers = users.filter((user) =>
                    (selectedUsers[`${rowId}_creator`] || []).includes(
                      Number(user.id),
                    ),
                  );

                  const visibleUsers = creatorUsers.slice(0, 2);

                  const extraCount = creatorUsers.length - 2;

                  return (
                    <div className="px-2 py-1 text-sm">
                      {creatorUsers.length > 0
                        ? visibleUsers.map((user) => user.userName).join(", ")
                        : "-"}

                      {extraCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();

                            setCreatorPopup({
                              open: true,

                              users: creatorUsers,
                            });
                          }}
                          className="
                                ml-2
                                rounded
                                bg-blue-100
                                px-2
                                py-[1px]
                                text-xs
                                font-semibold
                                text-blue-700
                                hover:bg-blue-200
                            "
                        >
                          +{extraCount}
                        </button>
                      )}
                    </div>
                  );
                })()
              : null,

            ...Object.fromEntries(
              levels.map((levelKey) => [
                levelKey,

                shouldShowSelect ? (
                  <SingleSelect
                    placeholder="Select User"
                    value={selectedUsers[`${rowId}_${levelKey}`] || []}
                    onChange={(values) =>
                      setSelectedUsers((prev) => ({
                        ...prev,

                        [`${rowId}_${levelKey}`]: values,
                      }))
                    }
                    options={users.map((user) => ({
                      value: user.id,
                      label: user.userName || "Unknown User",
                    }))}
                  />
                ) : null,
              ]),
            ),
          });
        }
        // Recursive Children

        if (hasChildren) {
          buildRows(item.children, level + 1, currentPath);
        }
      });
    };

    buildRows(approvalModules, 0);

    return rows;
  }, [levels, selectedUsers, users]);

  // Build Payload

  const buildPayload = () => {
    const modules = tableData
      .map((row) => {
        const approverUsers = [];

        // Approvers

        levels.forEach((levelKey, index) => {
          const selectedLevelUsers =
            selectedUsers[`${row.id}_${levelKey}`] || [];

          if (selectedLevelUsers.length > 0) {
            approverUsers.push({
              userId: Number(selectedLevelUsers[0]),

              level: index + 1,
            });
          }
        });

        // Creators

        const creatorUsers = selectedUsers[`${row.id}_creator`] || [];

        return {
          moduleCode: row.moduleCode,

          creatorUsers: creatorUsers.map((id) => ({
            userId: Number(id),
          })),
          approverUsers,
        };
      })

      .filter(
        (item) => item.creatorUsers.length > 0 || item.approverUsers.length > 0,
      );

    return {
      projectCode: projectCode.trim(),
      modules,
    };
  };

  // Save Approval Path

  const handleSave = async () => {
    try {
      if (!projectCode.trim()) {
        toast.error("Please search project first");
        return;
      }

      const payload = buildPayload();

      if (payload.modules.length === 0) {
        toast.error("Please select at least one user");
        return;
      }

      setSaving(true);

      await apiRequest({
        url: API_ENDPOINTS.SETTINGS.APPROVAL_PATH.SAVE,

        method: "POST",
        data: payload,
      });

      toast.success("Approval path saved successfully");
    } catch (err) {
      console.error("Save failed", err);

      toast.error("Failed to save approval path");
    } finally {
      setSaving(false);
    }
  };

  // Columns

  const columns = [
    {
      header: "Module/Sub Module",
      accessor: "name",
      width: "450px",
    },

    {
      header: "Creator",
      accessor: "creator",
      width: "220px",
    },

    ...levels.map((level) => ({
      header: level,
      accessor: level,
      width: "220px",
    })),
  ];

  const router = useRouter();

  const actions = getPageActions({
    router,
  });

  // JSX

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="bg-white border shadow-lg p-8">
        <h1 className="text-center text-3xl font-bold mb-10">APPROVAL PATH</h1>

        <div className="max-w-5xl mx-auto mb-8">
          <div className="grid grid-cols-12 gap-3">
            <label className="col-span-2 bg-sky-100 border rounded px-3 py-2">
              Project Code
            </label>

            <Input
              className="col-span-3"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />

            <Button
              className="col-span-2"
              onClick={handleSearch}
              disabled={loading}
            >
              <Search className="size-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-3 mt-3">
            <label className="col-span-2 bg-sky-100 border rounded px-3 py-2">
              Project Name
            </label>

            <Input
              disabled
              value={projectName}
              className="col-span-8 bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-12 gap-3 mt-3">
            <label className="col-span-2 bg-sky-100 border rounded px-3 py-2">
              Client Name
            </label>
            <Input
              disabled
              value={projectTitle}
              className="col-span-8 bg-gray-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mb-5">
          <Button variant="outline" onClick={removeLevel}>
            <Minus className="size-4 mr-2" />
            Remove Level
          </Button>

          <Button onClick={addLevel}>
            <Plus className="size-4 mr-2" />
            Add Level
          </Button>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-2" />
            Save
          </Button>
        </div>

        <div
          className="
                    [&_.max-h-80]:!max-h-none
                    [&_.overflow-y-auto]:!overflow-visible
                    "
        >
          <DataTable columns={columns} data={tableData} />
        </div>
        <CreatorUsersPopup
          open={creatorPopup.open}
          users={creatorPopup.users}
          onClose={() =>
            setCreatorPopup({
              open: false,
              users: [],
            })
          }
        />
      </div>
    </HeaderWrapper>
  );
}
