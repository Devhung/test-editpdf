# Hướng dẫn tích hợp PDF Editor

Tài liệu này hướng dẫn cách tích hợp PDF Editor vào ứng dụng ReactJS và React Native của bạn.

## 1. Quy tắc đặt tên Message Types

### 1.1. Cấu trúc chung
Message types được đặt theo cấu trúc: `[OBJECT]_[ACTION]` hoặc `[OBJECT]_[SUBJECT]_[ACTION]`

### 1.2. Quy tắc cụ thể
1. **Request Types**:
   - Sử dụng format: `[OBJECT]_[ACTION]`
   - Ví dụ: `PDF_LOAD`, `IMAGE_ADD`, `TOOLS_VISIBILITY_UPDATE`

2. **Response Types**:
   - Sử dụng format: `[OBJECT]_[ACTION]D` (thêm 'D' ở cuối)
   - Ví dụ: `PDF_SAVED`, `IMAGE_ADDED`

3. **Complex Actions**:
   - Sử dụng format: `[OBJECT]_[SUBJECT]_[ACTION]`
   - Ví dụ: `TOOLS_VISIBILITY_UPDATE`, `PDF_PAGE_ADD`

### 1.3. Danh sách Type

| Type | Description | Data | Direction |
|------|-------------|------|-----------|
| EDITOR_READY | Editor đã sẵn sàng nhận lệnh | { showTools, patientInfo, language } | Editor → Parent |
| INIT_DATA | Khởi tạo dữ liệu cho editor | { title, pdfFile, tools, patientInfo, language } | Parent → Editor |
| PDF_LOAD | Tải PDF vào editor | File hoặc Uint8Array | Parent → Editor |
| PDF_SAVE | Yêu cầu lưu PDF | None | Parent → Editor |
| PDF_SAVED | PDF đã được lưu | Blob hoặc Base64 string | Editor → Parent |
| IMAGE_ADD | Thêm hình ảnh vào editor | File hoặc Uint8Array | Parent → Editor |
| TOOLS_VISIBILITY_UPDATE | Cập nhật hiển thị tools và tính năng | { choosePDF, addImage, addText, addDrawing, savePDF, patient } | Parent → Editor |
| PATIENT_INFO_UPDATE | Cập nhật thông tin bệnh nhân | { fullName, dateOfBirth } | Parent → Editor |
| LANGUAGE_CHANGE | Thay đổi ngôn ngữ | string | Parent → Editor |

### 1.4. Chi tiết Type

#### 1.4.1. EDITOR_READY
Khi editor khởi tạo xong và sẵn sàng nhận lệnh, nó sẽ gửi message này đến parent window. Parent window có thể dùng cơ hội này để khởi tạo editor với dữ liệu ban đầu thông qua message `INIT_DATA`.

```javascript
{
  type: 'EDITOR_READY',
  data: {
    showTools: {
      choosePDF: true,
      addImage: true,
      addText: true,
      addDrawing: true,
      savePDF: true,
      patient: {
        showInfo: true,
        allowCreate: true
      }
    },
    patientInfo: {
      fullName: 'John Doe',
      dateOfBirth: '1990-01-01'
    },
    language: 'en'
  }
}
```

#### 1.4.2. INIT_DATA
Dùng để khởi tạo editor với dữ liệu ban đầu. Message này thường được gửi ngay sau khi nhận được `EDITOR_READY`.

```javascript
{
  type: 'INIT_DATA',
  data: {
    title: string,           // Tên file hiển thị
    pdfFile: Blob,          // File PDF ban đầu
    tools: {                // Cấu hình hiển thị tools và tính năng
      choosePDF: boolean,
      addImage: boolean,
      addText: boolean,
      addDrawing: boolean,
      savePDF: boolean,
      patient: {
        showInfo: boolean,    // Hiển thị thông tin bệnh nhân
        allowCreate: boolean  // Cho phép tạo bệnh nhân mới
      }
    },
    patientInfo: {          // Thông tin bệnh nhân
      fullName: string,
      dateOfBirth: string
    },
    language: string        // Mã ngôn ngữ (vd: 'en', 'vi')
  }
}
```

#### 1.4.3. PDF_LOAD
Dùng để tải một file PDF vào editor. File có thể được gửi dưới dạng Blob hoặc Uint8Array.

```javascript
{
  type: 'PDF_LOAD',
  data: File // PDF file object hoặc Uint8Array
}
```

#### 1.4.4. PDF_SAVE
Yêu cầu editor lưu PDF hiện tại. Editor sẽ trả về file PDF đã được chỉnh sửa thông qua message `PDF_SAVED`.

```javascript
{
  type: 'PDF_SAVE'
}
```

#### 1.4.5. PDF_SAVED
Message trả về từ editor khi quá trình lưu PDF hoàn tất.

```javascript
{
  type: 'PDF_SAVED',
  data: Blob // PDF blob object đã được chỉnh sửa
}
```

#### 1.4.6. IMAGE_ADD
Thêm một hình ảnh vào PDF tại trang hiện tại. File có thể được gửi dưới dạng Blob hoặc Uint8Array.

```javascript
{
  type: 'IMAGE_ADD',
  data: File // Image file object hoặc Uint8Array
}
```

#### 1.4.7. TOOLS_VISIBILITY_UPDATE
Cập nhật trạng thái hiển thị của các công cụ và tính năng trong editor.

```javascript
{
  type: 'TOOLS_VISIBILITY_UPDATE',
  data: {
    choosePDF: true,
    addImage: true,
    addText: true,
    addDrawing: true,
    savePDF: true,
    patient: {
      showInfo: true,      // Hiển thị thông tin bệnh nhân
      allowCreate: true    // Cho phép tạo bệnh nhân mới
    }
  }
}
```

#### 1.4.8. PATIENT_INFO_UPDATE
Cập nhật thông tin bệnh nhân được hiển thị trong editor.

```javascript
{
  type: 'PATIENT_INFO_UPDATE',
  data: {
    fullName: 'John Doe',
    dateOfBirth: '1990-01-01'
  }
}
```

#### 1.4.9. LANGUAGE_CHANGE
Thay đổi ngôn ngữ hiển thị của editor.

```javascript
{
  type: 'LANGUAGE_CHANGE',
  data: 'en'  // hoặc 'vi'
}
```

## 2. Tích hợp với ReactJS (iframe)

### 2.1. Cài đặt

Không cần cài đặt thêm thư viện, chúng ta sẽ sử dụng iframe HTML thuần.

### 2.2. Component Example

```jsx
import React, { useEffect, useRef, useState } from 'react';

const PDFEditor = ({ initialLanguage = 'vi' }) => {
  const editorRef = useRef(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);

  useEffect(() => {
    // Lắng nghe message từ editor
    const handleMessage = (event) => {
      // Trong production cần verify origin
      // if (event.origin !== "YOUR_EDITOR_ORIGIN") return;
      
      const { type, data } = event.data;
      
      switch(type) {
        case 'EDITOR_READY':
          setIsEditorReady(true);
          // Gửi dữ liệu khởi tạo khi editor sẵn sàng
          if (editorRef.current) {
            editorRef.current.contentWindow.postMessage({
              type: 'INIT_DATA',
              data: {
                title: 'New Document',
                tools: {
                  choosePDF: true,
                  addImage: true,
                  addText: true,
                  addDrawing: true,
                  savePDF: true,
                  patient: {
                    showInfo: true,
                    allowCreate: true
                  }
                },
                patientInfo: {
                  fullName: '',
                  dateOfBirth: ''
                },
                language: currentLanguage
              }
            }, '*');
          }
          break;
          
        case 'PDF_SAVED':
          if (data instanceof Blob) {
            handleSavedPDF(data);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentLanguage]);

  const handleSavedPDF = (blob) => {
    // Tạo URL và tải xuống PDF
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited-document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const changeLanguage = (newLanguage) => {
    if (isEditorReady && editorRef.current) {
      editorRef.current.contentWindow.postMessage({
        type: 'LANGUAGE_CHANGE',
        data: newLanguage
      }, '*');
      setCurrentLanguage(newLanguage);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => changeLanguage('vi')}>Tiếng Việt</button>
        <button onClick={() => changeLanguage('en')}>English</button>
      </div>
      
      <iframe
        ref={editorRef}
        src="https://test-editpdf.vercel.app"
        style={{
          width: '100%',
          height: '90vh',
          border: 'none'
        }}
      />
    </div>
  );
};

export default PDFEditor;
```

### 2.3. Sử dụng Component

```jsx
import PDFEditor from './components/PDFEditor';

function App() {
  return (
    <div>
      <h1>PDF Editor Integration</h1>
      <PDFEditor initialLanguage="vi" />
    </div>
  );
}
```

## 2. Tích hợp với React Native (WebView)

### 2.1. Cài đặt

```bash
npm install react-native-webview
# hoặc
yarn add react-native-webview
```

### 2.2. Component Example

```jsx
import React, { useRef, useState } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'react-native-fs';
import Share from 'react-native-share';

const PDFEditorScreen = ({ initialLanguage = 'vi' }) => {
  const webViewRef = useRef(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);

  // Xử lý message từ WebView
  const handleMessage = (event) => {
    const { type, data } = JSON.parse(event.nativeEvent.data);
    
    switch(type) {
      case 'EDITOR_READY':
        setIsEditorReady(true);
        // Gửi dữ liệu khởi tạo khi editor sẵn sàng
        const initData = {
          type: 'INIT_DATA',
          data: {
            title: 'New Document',
            tools: {
              choosePDF: true,
              addImage: true,
              addText: true,
              addDrawing: true,
              savePDF: true,
              patient: {
                showInfo: true,
                allowCreate: true
              }
            },
            patientInfo: {
              fullName: '',
              dateOfBirth: ''
            },
            language: currentLanguage
          }
        };
        webViewRef.current?.injectJavaScript(`
          window.postMessage(${JSON.stringify(initData)}, '*');
          true;
        `);
        break;
        
      case 'PDF_SAVED':
        handleSavedPDF(data);
        break;
    }
  };

  // Xử lý PDF đã lưu
  const handleSavedPDF = async (base64PDF) => {
    try {
      // Lưu file tạm thời
      const fileName = 'edited-document.pdf';
      const filePath = `${FileSystem.CacheDirectoryPath}/${fileName}`;
      await FileSystem.writeFile(filePath, base64PDF, 'base64');

      // Chia sẻ file PDF
      await Share.open({
        url: `file://${filePath}`,
        type: 'application/pdf',
        filename: fileName
      });

      // Xóa file tạm sau khi chia sẻ
      await FileSystem.unlink(filePath);
    } catch (error) {
      console.error('Error handling PDF:', error);
    }
  };

  // Thay đổi ngôn ngữ
  const changeLanguage = (newLanguage) => {
    if (isEditorReady && webViewRef.current) {
      const languageMessage = {
        type: 'LANGUAGE_CHANGE',
        data: newLanguage
      };
      webViewRef.current.injectJavaScript(`
        window.postMessage(${JSON.stringify(languageMessage)}, '*');
        true;
      `);
      setCurrentLanguage(newLanguage);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button 
          title="Tiếng Việt" 
          onPress={() => changeLanguage('vi')} 
        />
        <Button 
          title="English" 
          onPress={() => changeLanguage('en')} 
        />
      </View>
      
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://test-editpdf.vercel.app' }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        style={styles.webview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  webview: {
    flex: 1,
  }
});

export default PDFEditorScreen;
```

### 2.3. Sử dụng Component

```jsx
import PDFEditorScreen from './screens/PDFEditorScreen';

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="PDFEditor" 
          component={PDFEditorScreen}
          options={{ title: 'PDF Editor' }}
          initialParams={{ initialLanguage: 'vi' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```
