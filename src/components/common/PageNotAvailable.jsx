// "use client";

// import { useRouter } from "next/navigation";

// export default function PageNotAvailable() {
//   const router = useRouter();

//   return (
//     <div
//       className="
//         min-h-[70vh]
//         w-full
//         flex
//         flex-col
//         items-center
//         justify-center
//         gap-4
//         px-4
//         text-center
//       "
//     >
//       <h1
//         className="
//           text-2xl
//           md:text-3xl
//           font-semibold
//         "
//       >
//         Page Not Available
//       </h1>

//       <p
//         className="
//           text-sm
//           md:text-base
//           text-gray-500
//         "
//       >
//         You don’t have access to this page.
//       </p>

//       <button
//         onClick={() => router.push("/")}
//         className="
//           px-5
//           py-2.5

//           bg-black
//           text-white

//           rounded-md

//           text-sm
//           md:text-base
//         "
//       >
//         Go Home
//       </button>
//     </div>
//   );
// }
"use client";

import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { goToBackPage } from "@/helper/goToBackPage";
import { goToHomePage } from "@/helper/goToHomePage";
import { useNavigationHistory } from "@/context/NavigationHistoryContext";

export default function PageNotAvailable() {
  const router = useRouter();
  const { stack } = useNavigationHistory();

  return (
    <div className="min-h-[78vh] max-h-[80vh] w-full flex items-center justify-center px-4 py-10">
      <div
        className="
          relative
          w-full
          max-w-xl
          overflow-hidden
          rounded-3xl
          border
          border-gray-200
          bg-white
          shadow-[0_10px_40px_rgba(0,0,0,0.08)]
        "
      >
        {/* Top Gradient Bar */}
        {/* <div
          className="
            h-2
            w-full
            bg-gradient-to-r
            from-red-500
            via-orange-400
            to-yellow-400
          "
        /> */}

        {/* Background Blur Circle */}
        <div
          className="
            absolute
            -top-20
            -right-20
            h-52
            w-52
            rounded-full
            bg-red-100
            blur-3xl
            opacity-60
          "
        />

        <div className="relative z-10 flex flex-col items-center px-6 py-12 md:px-10">
          {/* Icon */}
          <div
            className="
              flex
              h-20
              w-20
              items-center
              justify-center
              rounded-2xl
              bg-red-50
              border
              border-red-100
              shadow-sm
            "
          >
            <ShieldAlert className="h-10 w-10 text-red-500" />
          </div>

          {/* Heading */}
          <h1
            className="
              mt-6
              text-2xl
              md:text-3xl
              font-bold
              text-gray-900
              tracking-tight
            "
          >
            Access Denied
          </h1>

          {/* Description */}
          <p
            className="
              mt-3
              max-w-md
              text-center
              text-sm
              md:text-base
              leading-6
              text-gray-500
            "
          >
            You do not have permission to access this module or page.
            Please contact your administrator if you believe this is an
            error.
          </p>

          {/* ERP Style Info Box */}
          <div
            className="
              mt-6
              w-full
              rounded-2xl
              border
              border-gray-200
              bg-gray-50
              p-4
            "
          >
            <div className="flex items-start gap-3">
              <div
                className="
                  mt-0.5
                  h-2.5
                  w-2.5
                  rounded-full
                  bg-red-500
                  shrink-0
                "
              />

              <div>
                <p className="text-sm font-medium text-gray-800">
                  Permission Required
                </p>

                <p className="mt-1 text-sm text-gray-500 leading-5">
                  Your current role does not include access to this
                  section in the ERP system.
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div
            className="
              mt-8
              flex
              flex-col
              sm:flex-row
              items-center
              gap-3
              w-full
              sm:w-auto
            "
          >
            <button
              onClick={() => goToBackPage(router, stack)}
              className="
                w-full
                sm:w-auto
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-gray-300
                bg-white
                px-5
                py-2.5
                text-sm
                font-medium
                text-gray-700
                transition-all
                hover:bg-gray-100
                cursor-pointer
              "
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>

            <button
              onClick={() => goToHomePage(router)}
              className="
                w-full
                sm:w-auto
                rounded-xl
                bg-black
                px-5
                py-2.5
                text-sm
                font-medium
                text-white
                transition-all
                hover:opacity-90
                cursor-pointer
              "
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}