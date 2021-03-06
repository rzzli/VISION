% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/Microclusters.R
\name{poolMatrixCols_Inner}
\alias{poolMatrixCols_Inner}
\title{create "super-cells" by pooling together single cells}
\usage{
poolMatrixCols_Inner(expr, pools)
}
\arguments{
\item{expr}{expression data (genes x cells matrix)}

\item{pools}{cluster association of each cell}
}
\value{
a matrx of expression data for the pooled cells (genes x pools)
}
\description{
create "super-cells" by pooling together single cells
}
