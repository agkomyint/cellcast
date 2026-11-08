"""Measure dynamic INT8 size and numerical drift; no biological accuracy claim."""
import json,time
import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic,QuantType
from export import OUT

path=OUT/'scgpt.int8.onnx'
quantize_dynamic(str(OUT/'scgpt.onnx'),str(path),weight_type=QuantType.QInt8,op_types_to_quantize=['MatMul','Gather'])
f=json.loads((OUT/'fixture.json').read_text())
s=ort.InferenceSession(str(path),providers=['CPUExecutionProvider'])
start=time.perf_counter();actual=s.run(None,{'src':np.array([f['src']],np.int64),'values':np.array([f['values']],np.float32),'mask':np.array([f['mask']],bool)})[0][0]
err=np.abs(actual-np.array(f['expected']))
report={'bytes':path.stat().st_size,'fixture_max_abs_error':float(err.max()),'fixture_mean_abs_error':float(err.mean()),'latency_ms':(time.perf_counter()-start)*1000,'biological_validation':False,'browser_validation':False,'default_in_app':False}
(OUT/'quantization-report.json').write_text(json.dumps(report,indent=2));print(report)
