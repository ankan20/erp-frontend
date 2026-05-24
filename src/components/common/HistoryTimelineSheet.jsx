// "use client";

// import { useEffect, useMemo, useState } from "react";

// import { Sheet, SheetContent } from "@/components/ui/sheet";

// import { ScrollArea } from "@/components/ui/scroll-area";

// import { Input } from "@/components/ui/input";

// import { Separator } from "@/components/ui/separator";

// import { Loader2, Search, Clock3, ChevronLeft, User2 } from "lucide-react";

// import { toast } from "sonner";

// import { apiRequest } from "@/lib/apiClient";

// import { WORKFLOW_ACTIONS } from "@/config/workflowAction.config";

// export default function HistoryTimelineSheet({
//   open,
//   onClose,
//   title = "History",
//   api,
//   entityId,
// }) {
//   const [loading, setLoading] = useState(false);

//   const [search, setSearch] = useState("");

//   const [history, setHistory] = useState([]);

//   useEffect(() => {
//     if (!open || !entityId) return;

//     const fetchHistory = async () => {
//       try {
//         setLoading(true);

//         const res = await apiRequest({
//           url: `${api}/${entityId}`,

//           method: "GET",
//         });

//         setHistory(res?.data || []);
//       } catch (err) {
//         toast.error(err?.message || "Failed to fetch history");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchHistory();
//   }, [open, api, entityId]);

//   const filteredHistory = useMemo(() => {
//     if (!search) return history;

//     return history.filter((item) => {
//       const value = `
//             ${item.action}
//             ${item.comments}
//             ${item.actionBy}
//           `.toLowerCase();

//       return value.includes(search.toLowerCase());
//     });
//   }, [history, search]);

//   const formatDate = (date) => {
//     if (!date) return "";

//     const parsed = new Date(date);

//     return parsed.toLocaleString("en-IN", {
//       day: "2-digit",

//       month: "short",

//       year: "numeric",

//       hour: "2-digit",

//       minute: "2-digit",

//       hour12: true,
//     });
//   };

//   return (
//     <Sheet open={open} onOpenChange={onClose}>
//       <SheetContent
//         side="right"
//         hideClose
//         className="
//     w-full
//     sm:max-w-[500px]

//     p-0

//     flex
//     flex-col

//     overflow-hidden
//   "
//       >
//         {/* HEADER */}

//         <div
//           className="
//             h-[64px]

//             px-4

//             flex
//             items-center
//             gap-3

//             border-b

//             bg-[#e8f2ff]

//             shrink-0
//           "
//         >
//           <button
//             onClick={onClose}
//             className="
//               w-8
//               h-8

//               rounded-full

//               border

//               bg-white/70

//               flex
//               items-center
//               justify-center

//               hover:bg-white

//               transition-colors
//             "
//           >
//             <ChevronLeft
//               className="
//                 w-5
//                 h-5
//               "
//             />
//           </button>

//           <h2
//             className="
//               text-[20px]
//               font-semibold
//             "
//           >
//             {title}
//           </h2>
//         </div>

//         {/* SEARCH */}

//         <div
//           className="
//             px-4
//             py-3

//             border-b

//             shrink-0

//             bg-white
//           "
//         >
//           <div className="relative">
//             <Search
//               className="
//                 absolute
//                 left-3
//                 top-1/2
//                 -translate-y-1/2

//                 w-4
//                 h-4

//                 text-gray-400
//               "
//             />

//             <Input
//               placeholder="Search history..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="
//                 pl-9
//                 h-[40px]
//               "
//             />
//           </div>
//         </div>

//         {/* TIMELINE */}

//         <ScrollArea
//           className="
//             flex-1
//             min-h-0
//           "
//         >
//           <div
//             className="
//               px-5
//               py-5
//             "
//           >
//             {loading ? (
//               <div
//                 className="
//                   h-[300px]

//                   flex
//                   items-center
//                   justify-center
//                 "
//               >
//                 <Loader2
//                   className="
//                     w-6
//                     h-6
//                     animate-spin
//                   "
//                 />
//               </div>
//             ) : filteredHistory.length === 0 ? (
//               <div
//                 className="
//                   h-[300px]

//                   flex
//                   flex-col
//                   items-center
//                   justify-center

//                   text-gray-500
//                 "
//               >
//                 <Clock3
//                   className="
//                     w-10
//                     h-10
//                     mb-3
//                   "
//                 />

//                 <p
//                   className="
//                     text-sm
//                   "
//                 >
//                   No history found
//                 </p>
//               </div>
//             ) : (
//               <div
//                 className="
//                   relative
//                   space-y-7
//                 "
//               >
//                 {filteredHistory.map((item, index) => {
//                   const config =
//                     WORKFLOW_ACTIONS[item.action] ||
//                     WORKFLOW_ACTIONS[item.action?.toUpperCase()] ||
//                     WORKFLOW_ACTIONS.DRAFT;

//                   const Icon = config.icon;

//                   const isLast = index === filteredHistory.length - 1;

//                   return (
//                     <div
//                       key={item.id}
//                       className="
//                           relative
//                           pl-10
//                         "
//                     >
//                       {/* LINE */}

//                       {!isLast && (
//                         <div
//                           className={`
//                               absolute
//                               left-[15px]
//                               top-8

//                               w-[2px]
//                               h-[calc(100%+28px)]

//                               ${
//                                 item.action === "REJECT"
//                                   ? "bg-red-200"
//                                   : "bg-gray-200"
//                               }
//                             `}
//                         />
//                       )}

//                       {/* ICON */}

//                       <div
//                         className={`
//                             absolute
//                             left-0
//                             top-1

//                             w-8
//                             h-8

//                             rounded-full

//                             flex
//                             items-center
//                             justify-center

//                             text-white

//                             shadow-sm

//                             ${config.color}
//                           `}
//                       >
//                         <Icon
//                           className="
//                               w-4
//                               h-4
//                             "
//                         />
//                       </div>

//                       {/* CARD */}

//                       <div
//                         className="
//                             rounded-xl
//                             border
//                             bg-white

//                             shadow-sm

//                             p-4
//                           "
//                       >
//                         <div
//                           className="
//                               flex
//                               items-start
//                               justify-between
//                               gap-3
//                             "
//                         >
//                           <div>
//                             <div
//                               className="
//                                   flex
//                                   items-center
//                                   gap-2
//                                   flex-nowrap
//                                 "
//                             >
//                               <span
//                                 className={`
//                                     px-2.5
//                                     py-1

//                                     rounded-md

//                                     text-[12px]
//                                     font-semibold

//                                     ${config.badge}
//                                   `}
//                               >
//                                 {config.label}
//                               </span>

//                               {item.action !== "SUBMIT" && item.level && (
//                                 <span
//   className="
//     text-xs
//     font-medium

//     text-gray-500

//     bg-gray-100

//     px-2
//     py-1

//     rounded-md

//     whitespace-nowrap
//     shrink-0
//   "
// >
//   {`Level ${item.level}`}
// </span>
//                               )}
//                             </div>

//                             <div
//                               className="
//                                   flex
//                                   items-center
//                                   gap-2
//                                   text-sm
//                                   text-gray-500
//                                   mt-2
//                                 "
//                             >
//                               <User2
//                                 className="
//                                     w-4
//                                     h-4
//                                   "
//                               />

//                               <span>
//                                 by{" "}
//                                 <span
//                                   className="
//                                       font-medium
//                                       text-gray-700
//                                     "
//                                 >
//                                   {item.actionBy || "System"}
//                                 </span>
//                               </span>
//                             </div>
//                           </div>

//                           <span
//                             className="
//                                 text-xs
//                                 text-gray-400
//                                 whitespace-nowrap
//                               "
//                           >
//                             {formatDate(item.createdAt)}
//                           </span>
//                         </div>

//                         {item.comments && (
//                           <div className="mt-3">
//                             <p
//                               className="
//                                   text-[12px]
//                                   font-medium

//                                   text-gray-500

//                                   mb-1.5
//                                 "
//                             >
//                               Comments
//                             </p>

//                             <div
//                               className="
//                                   rounded-lg
//                                   border

//                                   bg-slate-50

//                                   px-3
//                                   py-2.5
//                                 "
//                             >
//                               <p
//                                 className="
//                                     text-sm
//                                     text-gray-700
//                                     leading-6
//                                   "
//                               >
//                                 {item.comments}
//                               </p>
//                             </div>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </div>
//         </ScrollArea>

//         <Separator />

//         {/* FOOTER */}

//         <div
//           className="
//             p-4
//             shrink-0
//             bg-white
//           "
//         >
//           <div
//             className="
//               flex
//               justify-end
//             "
//           >
//             <button
//               onClick={onClose}
//               className="
//                 h-[40px]
//                 px-5
//                 rounded-md
//                 border
//                 text-sm
//                 font-medium
//                 hover:bg-gray-50
//                 cursor-pointer
//               "
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// }

// "use client";

// import { useEffect, useMemo, useState } from "react";

// import Image from "next/image";

// import { Sheet, SheetContent } from "@/components/ui/sheet";

// import { ScrollArea } from "@/components/ui/scroll-area";

// import { Input } from "@/components/ui/input";

// import { Separator } from "@/components/ui/separator";

// import { Loader2, Search, Clock3, ChevronLeft, User2 } from "lucide-react";

// import { toast } from "sonner";

// import { apiRequest } from "@/lib/apiClient";

// import { WORKFLOW_ACTIONS } from "@/config/workflowAction.config";

// export default function HistoryTimelineSheet({
//   open,
//   onClose,
//   title = "History",
//   api,
//   entityId,
// }) {
//   const [loading, setLoading] = useState(false);

//   const [search, setSearch] = useState("");

//   const [history, setHistory] = useState([]);

//   useEffect(() => {
//     if (!open || !entityId) return;

//     const fetchHistory = async () => {
//       try {
//         setLoading(true);

//         const res = await apiRequest({
//           url: `${api}/${entityId}`,

//           method: "GET",
//         });

//         setHistory(res?.data || []);
//       } catch (err) {
//         toast.error(err?.message || "Failed to fetch history");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchHistory();
//   }, [open, api, entityId]);

//   const filteredHistory = useMemo(() => {
//     if (!search) return history;

//     return history.filter((item) => {
//       const value = `
//             ${item.action}
//             ${item.comments}
//             ${item.actionBy}
//           `.toLowerCase();

//       return value.includes(search.toLowerCase());
//     });
//   }, [history, search]);

//   const formatDate = (date) => {
//     if (!date) return "";

//     const parsed = new Date(date);

//     return parsed.toLocaleString("en-IN", {
//       day: "2-digit",

//       month: "short",

//       year: "numeric",

//       hour: "2-digit",

//       minute: "2-digit",

//       hour12: true,
//     });
//   };

//   return (
//     <Sheet open={open} onOpenChange={onClose}>
//       <SheetContent
//         side="right"
//         hideClose
//         className="
//           w-full
//           sm:max-w-[500px]

//           p-0

//           flex
//           flex-col

//           overflow-hidden
//         "
//       >
//         {/* HEADER */}

//         <div
//           className="
//             h-[64px]

//             px-4

//             flex
//             items-center
//             gap-3

//             border-b

//             bg-[#e8f2ff]

//             shrink-0
//           "
//         >
//           <button
//             onClick={onClose}
//             className="
//               w-8
//               h-8

//               rounded-full

//               border

//               bg-white/70

//               flex
//               items-center
//               justify-center

//               hover:bg-white

//               transition-colors
//             "
//           >
//             <ChevronLeft
//               className="
//                 w-5
//                 h-5
//               "
//             />
//           </button>

//           <h2
//             className="
//               text-[20px]
//               font-semibold
//             "
//           >
//             {title}
//           </h2>
//         </div>

//         {/* SEARCH */}

//         <div
//           className="
//             px-4
//             py-3

//             border-b

//             shrink-0

//             bg-white
//           "
//         >
//           <div className="relative">
//             <Search
//               className="
//                 absolute
//                 left-3
//                 top-1/2
//                 -translate-y-1/2

//                 w-4
//                 h-4

//                 text-gray-400
//               "
//             />

//             <Input
//               placeholder="Search history..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="
//                 pl-9
//                 h-[40px]
//               "
//             />
//           </div>
//         </div>

//         {/* TIMELINE */}

//         <ScrollArea
//           className="
//             flex-1
//             min-h-0
//           "
//         >
//           <div
//             className="
//               px-5
//               py-5
//             "
//           >
//             {loading ? (
//               <div
//                 className="
//                   h-[300px]

//                   flex
//                   items-center
//                   justify-center
//                 "
//               >
//                 <Loader2
//                   className="
//                     w-6
//                     h-6
//                     animate-spin
//                   "
//                 />
//               </div>
//             ) : filteredHistory.length === 0 ? (
//               <div
//                 className="
//                   h-[300px]

//                   flex
//                   flex-col
//                   items-center
//                   justify-center

//                   text-gray-500
//                 "
//               >
//                 <Clock3
//                   className="
//                     w-10
//                     h-10
//                     mb-3
//                   "
//                 />

//                 <p
//                   className="
//                     text-sm
//                   "
//                 >
//                   No history found
//                 </p>
//               </div>
//             ) : (
//               <div
//                 className="
//                   relative
//                   space-y-7
//                 "
//               >
//                 {filteredHistory.map((item, index) => {
//                   const config =
//                     WORKFLOW_ACTIONS[item.action] ||
//                     WORKFLOW_ACTIONS[item.action?.toUpperCase()] ||
//                     WORKFLOW_ACTIONS.DRAFT;

//                   const Icon = config.icon;

//                   const isLast = index === filteredHistory.length - 1;

//                   const isFinalApprove =
//                     item.action?.toUpperCase() === "FINAL_APPROVE";

//                   return (
//                     <div
//                       key={item.id}
//                       className="
//                           relative
//                           pl-10
//                         "
//                     >
//                       {/* LINE */}

//                       {!isLast && (
//                         <div
//                           className={`
//                               absolute
//                               left-[15px]
//                               top-8

//                               w-[2px]
//                               h-[calc(100%+28px)]

//                               ${
//                                 item.action === "REJECT"
//                                   ? "bg-red-200"
//                                   : "bg-gray-200"
//                               }
//                             `}
//                         />
//                       )}

//                       {/* ICON */}

//                       <div
//                         className={`
//     absolute
//     left-0
//     top-1

//     w-9
//     h-9

//     rounded-full

//     flex
//     items-center
//     justify-center

//     shadow-sm

//     shrink-0

//     ${
//       isFinalApprove
//         ? "bg-white border border-emerald-200"
//         : `${config.color} text-white`
//     }
//   `}
//                       >
//                         {isFinalApprove ? (
//                           <Image
//                             src={config.image}
//                             alt="Final Approved"
//                             width={26}
//                             height={26}
//                             className="
//     animate-pulse
//     object-contain
//   "
//                           />
//                         ) : (
//                           <Icon
//                             className="
//                                 w-4
//                                 h-4
//                               "
//                           />
//                         )}
//                       </div>

//                       {/* CARD */}

//                       <div
//   className="
//     rounded-xl
//     border
//     bg-white

//     shadow-sm

//     p-4

//     mr-2
//   "
// >
//                         <div
//                           className="
//                               flex
//                               items-start
//                               justify-between
//                               gap-3
//                             "
//                         >
//                           <div>
//                             <div
//                               className="
//                                   flex
//                                   items-center
//                                   gap-2
//                                   flex-nowrap
//                                 "
//                             >
//                               <span
//                                 className={`
//                                     px-2.5
//                                     py-1

//                                     rounded-md

//                                     text-[12px]
//                                     font-semibold

//                                     whitespace-nowrap

//                                     ${
//                                       isFinalApprove
//                                         ? "bg-emerald-100 text-emerald-700"
//                                         : config.badge
//                                     }
//                                   `}
//                               >
//                                 {config.label}
//                               </span>

//                               {item.action?.toUpperCase() !== "SUBMIT" &&
//                                 item.level && (
//                                   <span
//                                     className="
//                                       text-xs
//                                       font-medium

//                                       text-gray-500

//                                       bg-gray-100

//                                       px-2
//                                       py-1

//                                       rounded-md

//                                       whitespace-nowrap
//                                       shrink-0
//                                     "
//                                   >
//                                     {`Level ${item.level}`}
//                                   </span>
//                                 )}
//                             </div>

//                             <div
//                               className="
//                                   flex
//                                   items-center
//                                   gap-2

//                                   text-sm
//                                   text-gray-500

//                                   mt-2
//                                 "
//                             >
//                               <User2
//                                 className="
//                                     w-4
//                                     h-4
//                                   "
//                               />

//                               <span>
//                                 by{" "}
//                                 <span
//                                   className="
//                                       font-medium
//                                       text-gray-700
//                                     "
//                                 >
//                                   {item.actionBy || "System"}
//                                 </span>
//                               </span>
//                             </div>
//                           </div>

//                           <span
//                             className="
//                                 text-xs
//                                 text-gray-400
//                                 whitespace-nowrap
//                               "
//                           >
//                             {formatDate(item.createdAt)}
//                           </span>
//                         </div>

//                         {item.comments && (
//                           <div className="mt-3">
//                             <p
//                               className="
//                                   text-[12px]
//                                   font-medium

//                                   text-gray-500

//                                   mb-1.5
//                                 "
//                             >
//                               Comments
//                             </p>

//                             <div
//                               className="
//                                   rounded-lg
//                                   border

//                                   bg-slate-50

//                                   px-3
//                                   py-2.5
//                                 "
//                             >
//                               <p
//                                 className="
//                                     text-sm
//                                     text-gray-700
//                                     leading-6
//                                   "
//                               >
//                                 {item.comments}
//                               </p>
//                             </div>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </div>
//         </ScrollArea>

//         <Separator />

//         {/* FOOTER */}

//         <div
//           className="
//             p-4
//             shrink-0
//             bg-white
//           "
//         >
//           <div
//             className="
//               flex
//               justify-end
//             "
//           >
//             <button
//               onClick={onClose}
//               className="
//                 h-[40px]
//                 px-5

//                 rounded-md
//                 border

//                 text-sm
//                 font-medium

//                 hover:bg-gray-50

//                 cursor-pointer
//               "
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// }


"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

import {
  ScrollArea,
} from "@/components/ui/scroll-area";

import { Input } from "@/components/ui/input";

import { Separator } from "@/components/ui/separator";

import {
  Loader2,
  Search,
  Clock3,
  ChevronLeft,
  User2,
} from "lucide-react";

import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";

import { WORKFLOW_ACTIONS } from "@/config/workflowAction.config";

export default function HistoryTimelineSheet({
  open,
  onClose,
  title = "History",
  api,
  entityId,
}) {

  const [loading, setLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [history, setHistory] =
    useState([]);

  useEffect(() => {

    if (!open || !entityId)
      return;

    const fetchHistory =
      async () => {

        try {

          setLoading(true);

          const res =
            await apiRequest({

              url:
                `${api}/${entityId}`,

              method:
                "GET",
            });

          setHistory(
            res?.data || [],
          );

        } catch (err) {

          toast.error(
            err?.message ||
            "Failed to fetch history",
          );

        } finally {

          setLoading(false);
        }
      };

    fetchHistory();

  }, [open, api, entityId]);

  const filteredHistory =
    useMemo(() => {

      if (!search)
        return history;

      return history.filter(
        (item) => {

          const value = `
            ${item.action}
            ${item.comments}
            ${item.actionBy}
          `
            .toLowerCase();

          return value.includes(
            search.toLowerCase(),
          );
        },
      );

    }, [history, search]);

  const formatDate = (
    date,
  ) => {

    if (!date)
      return "";

    const parsed =
      new Date(date);

    return parsed.toLocaleString(
      "en-IN",
      {

        day: "2-digit",

        month: "short",

        year: "numeric",

        hour: "2-digit",

        minute: "2-digit",

        hour12: true,
      },
    );
  };

  return (

    <Sheet
      open={open}
      onOpenChange={
        onClose
      }
    >

      <SheetContent
        side="right"

        hideClose

        className="
          w-full
          sm:max-w-[500px]

          p-0

          flex
          flex-col

          overflow-hidden
        "
      >

        {/* HEADER */}

        <div
          className="
            h-[64px]

            px-4

            flex
            items-center
            gap-3

            border-b

            bg-[#e8f2ff]

            shrink-0
          "
        >

          <button
            onClick={onClose}
            className="
              w-8
              h-8

              rounded-full

              border

              bg-white/70

              flex
              items-center
              justify-center

              hover:bg-white

              transition-colors
            "
          >

            <ChevronLeft
              className="
                w-5
                h-5
              "
            />

          </button>

          <h2
            className="
              text-[20px]
              font-semibold
            "
          >
            {title}
          </h2>

        </div>

        {/* SEARCH */}

        <div
          className="
            px-4
            py-3

            border-b

            shrink-0

            bg-white
          "
        >

          <div className="relative">

            <Search
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2

                w-4
                h-4

                text-gray-400
              "
            />

            <Input
              placeholder="Search history..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value,
                )
              }
              className="
                pl-9
                h-[40px]
              "
            />

          </div>

        </div>

        {/* TIMELINE */}

        <ScrollArea
          className="
            flex-1
            min-h-0
            overflow-x-hidden
          "
        >

          <div
            className="
              px-5
              py-5
            "
          >

            {loading ? (

              <div
                className="
                  h-[300px]

                  flex
                  items-center
                  justify-center
                "
              >

                <Loader2
                  className="
                    w-6
                    h-6
                    animate-spin
                  "
                />

              </div>

            ) : filteredHistory.length === 0 ? (

              <div
                className="
                  h-[300px]

                  flex
                  flex-col
                  items-center
                  justify-center

                  text-gray-500
                "
              >

                <Clock3
                  className="
                    w-10
                    h-10
                    mb-3
                  "
                />

                <p
                  className="
                    text-sm
                  "
                >
                  No history found
                </p>

              </div>

            ) : (

              <div
                className="
                  relative
                  space-y-7
                "
              >

                {filteredHistory.map(
                  (
                    item,
                    index,
                  ) => {

                    const config =
                      WORKFLOW_ACTIONS[
                        item.action
                      ] ||

                      WORKFLOW_ACTIONS[
                        item.action?.toUpperCase()
                      ] ||

                      WORKFLOW_ACTIONS.DRAFT;

                    const Icon =
                      config.icon;

                    const isLast =
                      index ===
                      filteredHistory.length -
                        1;

                    const isFinalApprove =
                      item.action?.toUpperCase() ===
                      "FINAL_APPROVE";

                    return (

                      <div
                        key={item.id}
                        className="
                          relative
                          pl-10
                        "
                      >

                        {/* LINE */}

                        {!isLast && (

                          <div
                            className={`
                              absolute
                              left-[15px]
                              top-8

                              w-[2px]
                              h-[calc(100%+28px)]

                              ${
                                item.action ===
                                "REJECT"
                                  ? "bg-red-200"
                                  : "bg-gray-200"
                              }
                            `}
                          />
                        )}

                        {/* ICON */}

                        <div
                          className={`
                            absolute
                            left-0
                            top-1

                            w-8
                            h-8

                            rounded-full

                            flex
                            items-center
                            justify-center

                            shadow-sm

                            shrink-0

                            overflow-hidden

                            ${
                              isFinalApprove
                                ? "bg-white border border-emerald-200"
                                : `${config.color} text-white`
                            }
                          `}
                        >

                          {isFinalApprove ? (

                            <Image
  src={config.image}
  alt="Final Approved"
  width={40}
  height={40}
  unoptimized
  className="
    w-full
    h-full
    object-contain
    scale-[1.2]
  "
/>

                          ) : (

                            <Icon
                              className="
                                w-4
                                h-4
                              "
                            />
                          )}

                        </div>

                        {/* CARD */}

                        <div
                          className="
                            rounded-xl
                            border
                            bg-white

                            shadow-sm

                            p-4
                          "
                        >

                          <div
                            className="
                              flex
                              items-start
                              justify-between
                              gap-3
                            "
                          >

                            <div
                              className="
                                min-w-0
                              "
                            >

                              <div
                                className="
                                  flex
                                  items-center
                                  gap-2

                                  flex-wrap
                                "
                              >

                                <span
                                  className={`
                                    px-2.5
                                    py-1

                                    rounded-md

                                    text-[12px]
                                    font-semibold

                                    whitespace-nowrap

                                    ${
                                      isFinalApprove
                                        ? "bg-emerald-100 text-emerald-700"
                                        : config.badge
                                    }
                                  `}
                                >

                                  {config.label}

                                </span>

                                {item.action?.toUpperCase() !==
                                  "SUBMIT" &&
                                  item.level && (

                                  <span
                                    className="
                                      text-xs
                                      font-medium

                                      text-gray-500

                                      bg-gray-100

                                      px-2
                                      py-1

                                      rounded-md

                                      whitespace-nowrap
                                    "
                                  >
                                    {`Level ${item.level}`}
                                  </span>
                                )}

                              </div>

                              <div
                                className="
                                  flex
                                  items-center
                                  gap-2

                                  text-sm
                                  text-gray-500

                                  mt-2
                                "
                              >

                                <User2
                                  className="
                                    w-4
                                    h-4
                                  "
                                />

                                <span>

                                  by{" "}

                                  <span
                                    className="
                                      font-medium
                                      text-gray-700
                                    "
                                  >
                                    {
                                      item.actionBy ||
                                      "System"
                                    }
                                  </span>

                                </span>

                              </div>

                            </div>

                            <span
                              className="
                                text-xs
                                text-gray-400

                                whitespace-nowrap

                                shrink-0
                              "
                            >
                              {formatDate(
                                item.createdAt,
                              )}
                            </span>

                          </div>

                          {item.comments && (

                            <div className="mt-3">

                              <p
                                className="
                                  text-[12px]
                                  font-medium

                                  text-gray-500

                                  mb-1.5
                                "
                              >
                                Comments
                              </p>

                              <div
                                className="
                                  rounded-lg
                                  border

                                  bg-slate-50

                                  px-3
                                  py-2.5
                                "
                              >

                                <p
                                  className="
                                    text-sm
                                    text-gray-700
                                    leading-6
                                  "
                                >
                                  {
                                    item.comments
                                  }
                                </p>

                              </div>

                            </div>
                          )}

                        </div>

                      </div>
                    );
                  },
                )}

              </div>
            )}

          </div>

        </ScrollArea>

        <Separator />

        {/* FOOTER */}

        <div
          className="
            p-4
            shrink-0
            bg-white
          "
        >

          <div
            className="
              flex
              justify-end
            "
          >

            <button
              onClick={onClose}
              className="
                h-[40px]
                px-5

                rounded-md
                border

                text-sm
                font-medium

                hover:bg-gray-50

                cursor-pointer
              "
            >
              Close
            </button>

          </div>

        </div>

      </SheetContent>

    </Sheet>
  );
}