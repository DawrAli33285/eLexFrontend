import React, { useState, useRef, useEffect } from "react";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";
import DatePicker from "react-datepicker";
import { useLocation, useParams } from "react-router-dom";
import axios from "axios";
import { BASE_URL } from "./baseUrl";
import { toast, ToastContainer } from "react-toastify";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const FRONTEND_SIGNATURE_WIDTH = 200;
const FRONTEND_SIGNATURE_HEIGHT = 80;
const FRONTEND_TEXT_WIDTH = 200;
const FRONTEND_TEXT_HEIGHT = 40;
const FRONTEND_DATE_WIDTH = 120;
const FRONTEND_DATE_HEIGHT = 45;

const SignDocumentPage = () => {
  const { documentId } = useParams();
  const [documentData, setDocumentData] = useState(null);
  const [loading,setLoading]=useState(false)
  const [currentProfile, setCurrentProfile] = useState("");
  const [file, setFile] = useState(null);
  const [signatureElements, setSignatureElements] = useState([]);
  const [activeElement, setActiveElement] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasContext, setCanvasContext] = useState(null);
  const [signatureType, setSignatureType] = useState();
  const [preference, setPreference] = useState({
    user: "",
    allowed_signature_types: "",
    notify_on_signatures: false,
    timezone: "",
    date_format: "",
    send_in_order: "",
  });
  const [numPages, setNumPages] = useState(1);
  const [pageNumber] = useState(1);
  const [currentUser, setCurrentUser] = useState("");
  const [loadingError, setLoadingError] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const getDocument = async () => {
      try {
        const token = localStorage.getItem("token");
        let params = new URLSearchParams(location.search);
        let email = params.get("email");

        if (!token) {
          let responseone = await axios.post(`${BASE_URL}/registerAndLogin`, {
            email,
          });
          localStorage.setItem("token", responseone.data.token);
          setCurrentUser(responseone.data.user);
          setPreference(responseone.data.preference);
          setCurrentProfile(responseone.data.profile);
          const response = await axios.get(
            `${BASE_URL}/getSpecificDoc/${documentId}`,
            {
              headers: { authorization: `Bearer ${responseone.data.token}` },
            }
          );
          setDocumentData(response.data.doc);
          setFile(response.data.doc.file);
          const elements =
            response.data.doc.elements?.map((el) => ({
              ...el,
              id: el._id || Math.random().toString(36).substr(2, 9),
              value: null,
              label: el.label || el.type,
            })) || [];
          setSignatureElements(elements);
        } else {
          const getUser = await axios.get(`${BASE_URL}/getUser`, {
            headers: { authorization: `Bearer ${token}` },
          });
          setCurrentUser(getUser.data.user);
          setPreference(getUser.data.preference);
          setCurrentProfile(getUser.data.profile);
          const response = await axios.get(
            `${BASE_URL}/getSpecificDoc/${documentId}`,
            {
              headers: { authorization: `Bearer ${token}` },
            }
          );
          const docData = response.data.doc;
          setDocumentData(docData);
          setFile(docData.file);
          const elements =
            docData.elements?.map((el) => ({
              ...el,
              id: el._id || Math.random().toString(36).substr(2, 9),
              value: null,
              label: el.label || el.type,
            })) || [];
          setSignatureElements(elements);
        }
      } catch (error) {
        setLoadingError("Failed to load document");
      }
    };
    getDocument();
  }, [documentId, location.search]);

  useEffect(() => {
    if (
      canvasRef.current &&
      activeElement?.type === "signature" &&
      signatureType === "draw"
    ) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      setCanvasContext(ctx);
      if (currentProfile?.signature) {
        const img = new Image();
        img.onload = () =>
          ctx.drawImage(
            img,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        img.src = currentProfile.signature;
      }
    }
  }, [activeElement, signatureType, currentProfile]);

  const startDrawing = (e) => {
    if (!activeElement || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    canvasContext.beginPath();
    canvasContext.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    canvasContext.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    canvasContext.stroke();
  };

  const stopDrawing = () => {
    canvasContext?.closePath();
    setIsDrawing(false);
  };

  const handleElementClick = (element) => {
    if (element?.recipientEmail !== currentUser?.email) return;
    setActiveElement(element);
    setSignatureType(null);
    switch (element.type) {
      case "checkbox":
        setInputValue(element.value || false);
        break;
      case "image":
        setInputValue(element.value || "");
        break;
      case "initials":
        setInputValue(element.value || currentProfile?.initials || "");
        break;
      case "radio":
        setInputValue(element.value || "");
        break;
      case "date":
        setSelectedDate(new Date(element.value || Date.now()));
        break;
      default:
        setInputValue(element.value || "");
    }
  };

  const convertTextToSignature = (text) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = FRONTEND_SIGNATURE_WIDTH;
    canvas.height = FRONTEND_SIGNATURE_HEIGHT;
    ctx.font = "italic 34px Great Vibes";
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL();
  };

  const handleSave = () => {
    if (!activeElement) return;
    let value;
    switch (activeElement.type) {
      case "signature":
        value =
          signatureType === "draw"
            ? canvasRef.current?.toDataURL()
            : signatureType === "image"
            ? inputValue || currentProfile?.signature
            : inputValue
            ? convertTextToSignature(inputValue)
            : null;
        break;
      case "checkbox":
        value = inputValue;
        break;
      case "image":
        value = inputValue;
        break;
      case "initials":
        value = inputValue.toUpperCase();
        break;
      case "radio":
        value = inputValue;
        break;
      case "date":
        value = selectedDate.toLocaleDateString();
        break;
      default:
        value = inputValue;
    }
    setSignatureElements((prev) =>
      prev.map((el) => (el.id === activeElement.id ? { ...el, value } : el))
    );
    setActiveElement(null);
    setInputValue("");
  };

  const handleImageUpload = (e) => {
    if (!activeElement || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSignatureElements((prev) =>
        prev.map((el) =>
          el.id === activeElement.id
            ? { ...el, value: event.target.result }
            : el
        )
      );
      setActiveElement(null);
    };
    reader.readAsDataURL(e.target.files[0]);
  };

  const handleClearCanvas = () => {
    if (!currentUser?.signature) {
      canvasContext.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
    } else {
      canvasContext.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      const img = new Image();
      img.onload = () =>
        canvasContext.drawImage(
          img,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
      img.src = currentUser.signature;
    }
  };

  const handleSaveDocument = async () => {
    try {
      const token = localStorage.getItem("token");
      setLoading(true)
      const embedResponse = await axios.post(
        `${BASE_URL}/embedElementsInPDF`,
        {
          documentId,
          elements: signatureElements,
        },
        {
          headers: { authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );
      const blob = new Blob([embedResponse.data], { type: "application/pdf" });
      const file = new File([blob], `signedDocument-${documentId}`, {
        type: "application/pdf",
      });
      const dataForm = new FormData();
      dataForm.append("document", file);
      dataForm.append("documentId", documentId);
      await axios.patch(`${BASE_URL}/editDocument/${documentId}`, dataForm, {
        headers: { authorization: `Bearer ${token}` },
      });
      await axios.patch(
        `${BASE_URL}/signDocument`,
        { documentId, email: currentUser.email },
        {
          headers: { authorization: `Bearer ${token}` },
        }
      );
      toast.success("Document signed", {
        containerId: "signaturesign",
      });
      window.location.href='/admin'
    } catch (error) {
      setLoading(false)
      toast.error(error?.response?.data?.error || "Something went wrong", {
        containerId: "signaturesign",
      });
    }
  };

  const declineSign = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${BASE_URL}/declineDocs`,
        { email: currentUser.email, docId: documentId },
        {
          headers: { authorization: `Bearer ${token}` },
        }
      );
      toast.success("Sign declined successfully", {
        containerId: "signaturesign",
      });
      setTimeout(() => window.close(), 500);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Something went wrong", {
        containerId: "signaturesign",
      });
    }
  };

  const renderFieldPreview = (element) => {
    const typeStyles = {
      signature: "border-blue-500 bg-blue-50",
      date: "border-purple-500 bg-purple-50",
      text: "border-gray-500 bg-gray-50",
      name: "border-green-500 bg-green-50",
      email: "border-yellow-500 bg-yellow-50",
      jobTitle: "border-pink-500 bg-pink-50",
      company: "border-indigo-500 bg-indigo-50",
      checkbox: "border-orange-500 bg-orange-50",
      radio: "border-teal-500 bg-teal-50",
      image: "border-indigo-500 bg-indigo-50",
      initials: "border-cyan-500 bg-cyan-50",
      stamp: "border-red-500 bg-red-50"
    };
  
    const dimensions = {
      signature: { width: FRONTEND_SIGNATURE_WIDTH, height: FRONTEND_SIGNATURE_HEIGHT },
      date: { width: FRONTEND_DATE_WIDTH, height: FRONTEND_DATE_HEIGHT },
      stamp: { width: FRONTEND_SIGNATURE_WIDTH, height: FRONTEND_SIGNATURE_HEIGHT },
      default: { width: FRONTEND_TEXT_WIDTH, height: FRONTEND_TEXT_HEIGHT }
    };
  
    const { width, height } = dimensions[element.type] || dimensions.default;
  
    return (
      <div
        className={`border-2 p-2 cursor-pointer overflow-hidden flex flex-col ${typeStyles[element.type]}`}
        onClick={() => handleElementClick(element)}
        style={{
          left: `${element.x}px`,
          top: `${element.y}px`,
          position: "absolute",
          width: `${width}px`,
          minHeight: `${height}px`,
        }}
      >
        <div className="flex-1">
          {element.value ? (
            element.type === "signature" || element.type === "image" || element.type === "stamp" ? (
              <img
                src={element.value}
                alt={element.type}
                className="w-full h-full object-contain"
              />
            ) : element.type === "checkbox" ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={element.value}
                  readOnly
                  className="w-4 h-4"
                />
              </div>
            ) : element.type === "initials" ? (
              <div className="text-2xl font-bold text-center">
                {element.value}
              </div>
            ) : (
              <span className="text-sm block break-words">{element.value}</span>
            )
          ) : (
            <span className="text-gray-500 text-sm block break-words">
              {element.label || element.type}
            </span>
          )}
        </div>
        
        <div className="mt-1 text-xs text-gray-600 bg-gray-100 px-1 py-0.5 rounded truncate">
          <span className="font-medium">For:</span> {element.recipientEmail}
        </div>
      </div>
    );
  };
  return (
    <div>
      <ToastContainer containerId={"signaturesign"} />
      <div className="flex h-screen bg-gray-100">
        <div className="flex-1 p-4 overflow-auto relative" ref={containerRef}>
          <button
            onClick={declineSign}
            className="absolute top-4 right-[20%] z-50 bg-[#29354a] text-white px-6 py-2 rounded-[20px] shadow-l"
          >
            Decline
          </button>
          <button
            onClick={handleSaveDocument}
            className="absolute top-4 right-4 z-50 bg-[#002864] text-white px-6 py-2 rounded-[20px] shadow-l"
            disabled={signatureElements.some(
              (el) => !el.value && el.recipientEmail === currentUser?.email
            )}
          >
            Complete Signing
          </button>

          {loadingError ? (
            <div className="text-red-500 text-center mt-8">{loadingError}</div>
          ) : file ? (
            file.includes(".pdf") ? (
              <div className="relative">
                <Document
                  file={file}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                >
                  <Page
                    pageNumber={pageNumber}
                    width={800}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </Document>
                {signatureElements.map(renderFieldPreview)}
              </div>
            ) : (
              <div className="relative">
                <img src={file} alt="Document" className="max-w-full h-auto" />
                {signatureElements.map(renderFieldPreview)}
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <p>Loading document...</p>
            </div>
          )}

          {activeElement && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-96">
                <h3 className="text-xl font-bold mb-4">
                  {activeElement.label}
                </h3>

                {activeElement.type === "signature" && (
                  <>
                    <div className="flex border-b mb-4">
                      <button
                        disabled={
                          !(
                            preference?.allowed_signature_types === "draw" ||
                            preference?.allowed_signature_types === "all"
                          )
                        }
                        className={`flex-1 py-2 ${
                          signatureType === "draw"
                            ? "border-b-2 border-blue-500"
                            : ""
                        }`}
                        onClick={() => setSignatureType("draw")}
                      >
                        Draw
                      </button>
                      <button
                        disabled={
                          !["upload", "all"].includes(
                            preference?.allowed_signature_types
                          )
                        }
                        className={`flex-1 py-2 ${
                          signatureType === "image"
                            ? "border-b-2 border-blue-500"
                            : ""
                        }`}
                        onClick={() => setSignatureType("image")}
                      >
                        Upload
                      </button>
                      <button
                        disabled={
                          !["type", "all"].includes(
                            preference?.allowed_signature_types
                          )
                        }
                        className={`flex-1 py-2 ${
                          signatureType === "typed"
                            ? "border-b-2 border-blue-500"
                            : ""
                        }`}
                        onClick={() => setSignatureType("typed")}
                      >
                        Type
                      </button>
                    </div>

                    {signatureType === "draw" && (
                      <canvas
                        ref={canvasRef}
                        width={FRONTEND_SIGNATURE_WIDTH}
                        height={FRONTEND_SIGNATURE_HEIGHT}
                        className="border mb-4"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                      />
                    )}

                    {signatureType === "image" && (
                      <div className="space-y-4">
                        {currentProfile?.signature && (
                          <div className="text-center">
                            <p className="text-sm text-gray-600 mb-2">
                              Existing Signature:
                            </p>
                            <img
                              src={currentProfile.signature}
                              alt="Existing Signature"
                              className="mx-auto w-40 h-20 object-contain border rounded"
                            />
                          </div>
                        )}
                        <label className="w-full border-2 border-dashed p-8 text-center cursor-pointer block mb-4">
                          {currentProfile?.signature
                            ? "Click to upload new image"
                            : "Click to upload signature image"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>
                    )}

                    {signatureType === "typed" && (
                      <>
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          className="w-full p-2 border rounded mb-4"
                          placeholder="Type your signature"
                        />
                        {inputValue && (
                          <div className="text-center border p-2">
                            <img
                              src={convertTextToSignature(inputValue)}
                              alt="Signature Preview"
                              className="mx-auto"
                              style={{
                                width: FRONTEND_SIGNATURE_WIDTH,
                                height: FRONTEND_SIGNATURE_HEIGHT,
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {activeElement.type === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inputValue}
                      onChange={(e) => setInputValue(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm">Checkbox</span>
                  </div>
                )}

                {activeElement.type === "image" && (
                  <div className="space-y-4">
                    <label className="w-full border-2 border-dashed p-8 text-center cursor-pointer block mb-4">
                      Click to upload image
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                    {inputValue && (
                      <img
                        src={inputValue}
                        alt="Preview"
                        className="mx-auto max-h-32 object-contain"
                      />
                    )}
                  </div>
                )}

                {activeElement.type === "initials" && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) =>
                        setInputValue(e.target.value.toUpperCase())
                      }
                      className="w-full p-2 border rounded mb-4 text-center text-xl font-bold"
                      placeholder="Enter initials"
                      maxLength={3}
                    />
                    {inputValue && (
                      <div className="text-center border p-2">
                        <div className="text-2xl font-bold">{inputValue}</div>
                      </div>
                    )}
                  </div>
                )}

                {activeElement.type === "radio" && (
                  <div className="space-y-2">
                    {(activeElement.options?.split(",") || []).map(
                      (option, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={activeElement.id}
                            checked={inputValue === option.trim()}
                            onChange={() => setInputValue(option.trim())}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{option.trim()}</span>
                        </label>
                      )
                    )}
                  </div>
                )}

                {activeElement.type === "date" && (
                  <DatePicker
                    selected={selectedDate}
                    onChange={setSelectedDate}
                    inline
                    className="w-full text-center"
                  />
                )}

                {["text", "name", "email", "jobTitle", "company"].includes(
                  activeElement.type
                ) && (
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full p-2 border rounded mb-4"
                    placeholder={`Enter ${activeElement.type}`}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setActiveElement(null)}
                    className="bg-gray-200 px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                    disabled={
                      activeElement.type === "signature" &&
                      signatureType === "typed" &&
                      !inputValue
                    }
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading?<div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
  <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl mx-4 text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
    <h3 className="text-2xl font-semibold text-gray-900 mb-2">
      Updating Document
    </h3>
    <p className="text-gray-600">
      Please wait while the document is being updated
    </p>
  </div>
</div>:``}
    </div>
  );
};

export default SignDocumentPage;
