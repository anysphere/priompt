use anyhow::Context;
use napi::bindgen_prelude::Error;
use napi_derive::napi;

// this is lazily initialized when accessed! so everything is FINE.
// we keep it thread local because it is relatively expensive to initialize, but we don't want race conditions.
// note: the first request on each thread will be slow... that's not very good, but I am not sure how to fix
// another option would be to use an arc<mutex<>>, which would queue up requests, but not have the cold start problem
// for now, we don't care, but in the future, if we care about ultralow latency with really high reliability, we should fix this
thread_local! {
  static CL100K_ENCODING: Result<tiktoken::Encoding, tiktoken::EncodingFactoryError>  = tiktoken::EncodingFactory::cl100k_base();
}

// this is the most common function to call! it is the tokenizer for gpt-4 and gpt-3.5-turbo, and in the chat model we have no special token handling
// this is also blocking and happening on the current thread, which is not very good
// ideally, we should make a non-blocking version that happens on a worker thread
#[napi]
pub fn num_tokens_cl_100k_no_special_tokens_blocking(text: String) -> Result<i32, Error> {
    CL100K_ENCODING.with(|enc| {
        let enc = match enc {
            Ok(enc) => enc,
            Err(e) => return Err(Error::from_reason(format!("Error getting encoding: {:?}", e))),
        };
        let tokens = enc
            .encode(
                &text,
                &tiktoken::SpecialTokenHandling {
                    // no special tokens!! everything is normal text
                    // this is how tokenization is handled in the chat model api
                    default: tiktoken::SpecialTokenAction::NormalText,
                    ..Default::default()
                },
            )
            .context("Error encoding string")
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(tokens.len() as i32)
    })
}

#[napi]
pub async fn num_tokens_cl_100k_no_special_tokens_non_blocking(text: String) -> Result<i32, Error> {
    let result = napi::tokio::task::spawn_blocking(move || {
        num_tokens_cl_100k_no_special_tokens_blocking(text)
    })
    .await;

    match result {
        Ok(Ok(val)) => Ok(val),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(Error::from_reason(format!("Error in tokio task: {:?}", e))),
    }
}

#[napi]
pub fn encode_cl_100k_no_special_tokens_blocking(text: String) -> Result<Vec<u32>, Error> {
    CL100K_ENCODING.with(|enc| {
        let enc = match enc {
            Ok(enc) => enc,
            Err(e) => return Err(Error::from_reason(format!("Error getting encoding: {:?}", e))),
        };
        let tokens = enc
            .encode(
                &text,
                &tiktoken::SpecialTokenHandling {
                    // no special tokens!! everything is normal text
                    // this is how tokenization is handled in the chat model api
                    default: tiktoken::SpecialTokenAction::NormalText,
                    ..Default::default()
                },
            )
            .context("Error encoding string")
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(tokens.into_iter().map(|t| t as u32).collect())
    })
}

#[napi]
pub async fn encode_cl_100k_no_special_tokens_non_blocking(
    text: String,
) -> Result<Vec<u32>, Error> {
    let result =
        napi::tokio::task::spawn_blocking(move || encode_cl_100k_no_special_tokens_blocking(text))
            .await;

    match result {
        Ok(Ok(val)) => Ok(val),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(Error::from_reason(format!("Error in tokio task: {:?}", e))),
    }
}

#[napi]
pub fn decode_cl_100k_no_special_tokens_blocking(
    encoded_tokens: Vec<u32>,
) -> Result<String, Error> {
    CL100K_ENCODING.with(|enc| {
        let enc = match enc {
            Ok(enc) => enc,
            Err(e) => return Err(Error::from_reason(format!("Error getting encoding: {:?}", e))),
        };
        let text = enc.decode(&encoded_tokens.into_iter().map(|t| t as usize).collect::<Vec<_>>());
        Ok(text)
    })
}

#[napi]
pub async fn decode_cl_100k_no_special_tokens_non_blocking(
    encoded_tokens: Vec<u32>,
) -> Result<String, Error> {
    let result = napi::tokio::task::spawn_blocking(move || {
        decode_cl_100k_no_special_tokens_blocking(encoded_tokens)
    })
    .await;

    match result {
        Ok(Ok(val)) => Ok(val),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(Error::from_reason(format!("Error in tokio task: {:?}", e))),
    }
}
